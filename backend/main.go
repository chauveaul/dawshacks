package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
)

type Song struct {
	Title  string `json:"title"`
	Artist string `json:"artist"`
	Album  string `json:"album"`
	SongId int64  `json:"songId"`
}

func main() {
	router := gin.Default()
	router.POST("/", ripMusic)

	err := router.Run("localhost:8080")
	if err != nil {
		fmt.Println(err)
	}
}

func ripMusic(c *gin.Context) {
	var song Song

	if err := c.BindJSON(&song); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Process the song data here
}
