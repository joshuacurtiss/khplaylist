const fs=require("fs-extra");
const jQuery=$=require("../bower_components/jquery/dist/jquery");
const parseWebVTT=require("../js/parseWebVTT");
var video, $curTime, $chname;
var cues=[];

$(document).ready(()=>{
    console.log("Hello!");
    video=document.getElementById("video");
    $curTime=$(".curTime");
    $chname=$(".chname");
    // Wire up listeners
    video.addEventListener("timeupdate", endChapter, false);
    video.addEventListener("timeupdate", timeui, false);
    video.addEventListener("click", toggleVideo, false);
    // Initialize a sample video
    loadVideo(`/Users/josh/Downloads/nwt_66_Re_ASL_21_r240P.m4v`);
    // Done!
    console.log("Initialized!");
    // Playing chapter
    playChapter(4);
});

function loadVideo(path){
    video=document.getElementById("video");
    video.src=path;
    var webvtt=fs.readFileSync(`${path}.webvtt`,`UTF-8`);
    cues=parseWebVTT(webvtt);
    // UI
    $(".duration").text(cues[cues.length-1].end.toFixed(2));
}

function playChapter(chnum){
    var ch=cues[chnum];
    console.log(`Playing chapter ${ch.content} (${ch.id}), from ${ch.start} to ${ch.end}.`);
    $chname.text(ch.content);
    video.setAttribute("data-chapter",ch.id);
    video.currentTime=parseFloat(ch.start);
    video.play();
}

function timeui(){
    $curTime.text(video.currentTime.toFixed(2));
}

function endChapter(){
    var curChapter=video.getAttribute("data-chapter");
    if( curChapter!="" ) {
        if( video.currentTime>=parseFloat(cues[curChapter].end) && !video.paused ) {
            video.pause();
            video.setAttribute("data-chapter","");
        }
    }
}

function toggleVideo(){
    if(!this.paused) this.pause(); else this.play();
}