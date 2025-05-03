package main

import (
	"encoding/binary"
	"fmt"
	"os"
	"os/signal"

	"github.com/gin-gonic/gin"
	"github.com/gordonklaus/portaudio"
)

func main() {
	router := gin.Default()
	router.GET("/", ripMusic)

	err := router.Run("localhost:8080")
	if err != nil {
		fmt.Println(err)
	}
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
