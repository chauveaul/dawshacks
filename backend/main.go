package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"

	"github.com/gin-gonic/gin"
	"github.com/gordonklaus/portaudio"
)

type song struct {
	SongId       string `json:"id"`
	Title        string `json:"title"`
	Artist       string `json:"artist"`
	AlbumPicture []byte `json:"album_picture"`
	Duration     int    `json:"duration"`
}

func main() {
	router := gin.Default()
	
	// Set up CORS
	router.Use(corsMiddleware())
	
	router.GET("/", ripMusic)
	router.POST("/queue", queueSong)

	err := router.Run("localhost:8080")
	if err != nil {
		fmt.Println(err)
	}
}

// Middleware to enable CORS for the frontend
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// Handler for queueing a song and storing its metadata
func queueSong(c *gin.Context) {
	var songData song
	
	// Bind the JSON body to the song struct
	if err := c.ShouldBindJSON(&songData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid song data"})
		return
	}
	
	// Print the received song data for debugging
	fmt.Printf("Received song: %s by %s (ID: %s, Duration: %d seconds)\n", 
		songData.Title, songData.Artist, songData.SongId, songData.Duration)
	
	// Save the metadata to a file
	fileName := fmt.Sprintf("metadata_%s.json", songData.SongId)
	metadataBytes, err := json.Marshal(songData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process metadata"})
		return
	}
	
	err = ioutil.WriteFile(fileName, metadataBytes, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save metadata"})
		return
	}
	
	// Start recording when a song is queued
	go ripMusic(c)
	
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Song queued and recording started"})
}

func ripMusic(c *gin.Context) {
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, os.Kill)

	// Create the output file
	f, err := os.Create("output.aiff")
	if err != nil {
		fmt.Println("Error creating file:", err)
		return
	}
	_, err = f.WriteString("FORM")
	checkError(err)
	checkError(binary.Write(f, binary.BigEndian, int32(0))) //total bytes
	_, err = f.WriteString("AIFF")
	checkError(err)

	// common chunk
	_, err = f.WriteString("COMM")
	checkError(err)
	checkError(binary.Write(f, binary.BigEndian, int32(18)))           //size
	checkError(binary.Write(f, binary.BigEndian, int16(2)))            //channels (changed to 2)
	checkError(binary.Write(f, binary.BigEndian, int32(0)))            //number of samples
	checkError(binary.Write(f, binary.BigEndian, int16(32)))           //bits per sample
	_, err = f.Write([]byte{0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0}) //80-bit sample rate 44100
	checkError(err)

	// sound chunk
	_, err = f.WriteString("SSND")
	checkError(err)
	checkError(binary.Write(f, binary.BigEndian, int32(0))) //size
	checkError(binary.Write(f, binary.BigEndian, int32(0))) //offset
	checkError(binary.Write(f, binary.BigEndian, int32(0))) //block
	nSamples := 0
	defer func() {
		// fill in missing sizes
		totalBytes := 4 + 8 + 18 + 8 + 8 + 4*nSamples
		_, err = f.Seek(4, 0)
		checkError(err)
		checkError(binary.Write(f, binary.BigEndian, int32(totalBytes)))
		_, err = f.Seek(22, 0)
		checkError(err)
		checkError(binary.Write(f, binary.BigEndian, int32(nSamples)))
		_, err = f.Seek(42, 0)
		checkError(err)
		checkError(binary.Write(f, binary.BigEndian, int32(4*nSamples+8)))
		checkError(f.Close())
	}()
	// Capture the stream of the song
	checkError(portaudio.Initialize())
	defer portaudio.Terminate()

	// Buffer for input samples - increase buffer size for better performance
	in := make([]int32, 1024)

	devices, err := portaudio.Devices()
	if err != nil {
		fmt.Println("Error getting devices:", err)
		return
	}

	var blackholeDevice *portaudio.DeviceInfo
	for _, device := range devices {
		if device.Name == "BlackHole 2ch" { // Replace "Blackhole" with the actual name of your blackhole device
			blackholeDevice = device
			break
		}
	}

	if blackholeDevice == nil {
		fmt.Println("Blackhole device not found")
		// List available devices to help troubleshooting
		fmt.Println("Available devices:")
		for i, d := range devices {
			fmt.Printf("%d: %s (in=%d, out=%d)\n", i, d.Name, d.MaxInputChannels, d.MaxOutputChannels)
		}
		return
	}

	fmt.Printf("Using device: %s\n", blackholeDevice.Name)

	// Create a stream for recording from the BlackHole device directly
	streamParams := portaudio.StreamParameters{
		Input: portaudio.StreamDeviceParameters{
			Device:   blackholeDevice,
			Channels: 2, // Changed to 2 channels to match BlackHole 2ch
			Latency:  blackholeDevice.DefaultLowInputLatency,
		},
		SampleRate:      44100,
		FramesPerBuffer: len(in),
	}

	stream, err := portaudio.OpenStream(streamParams, &in)
	if err != nil {
		fmt.Println("Error opening stream with BlackHole device:", err)
		return
	}

	defer stream.Close()

	checkError(stream.Start())
	fmt.Println("Recording started. Press Ctrl+C to stop.")

	for {
		err := stream.Read()
		if err != nil {
			fmt.Println("Error reading from stream:", err)
			break
		}

		checkError(binary.Write(f, binary.BigEndian, in))
		nSamples += len(in)

		select {
		case <-sig:
			fmt.Println("Recording stopped.")
			return
		default:
		}
	}
}

func checkError(err error) {
	if err != nil {
		panic(err)
	}
}
