// Dependencies
const VideoController=require("../controllers/VideoController");

// Globals
var videoController;

document.addEventListener("DOMContentLoaded", function(event) {
    videoController=new VideoController(document.getElementById("video"),document.getElementById("text"));
});
