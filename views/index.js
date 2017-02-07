const fs=require("fs-extra");
const parseWebVTT=require("../js/parseWebVTT");
var video, curTime, chname;
var cues=[];

window.onload=()=>{
    console.log("Hello!");
    video=document.getElementById("video");
    curTime=document.getElementById("curTime");
    chname=document.getElementById("chname");
    // Wire up listeners
    video.addEventListener("timeupdate", endChapter, false);
    video.addEventListener("timeupdate", timeui, false);
    // Initialize a sample video
    loadVideo(`/Users/josh/Downloads/nwt_66_Re_ASL_21_r240P.m4v`);
    // Done!
    console.log("Initialized!");
    // Playing chapter
    playChapter(3);
};

function loadVideo(path){
    video=document.getElementById("video");
    video.src=path;
    var webvtt=fs.readFileSync(`${path}.webvtt`,`UTF-8`);
    cues=parseWebVTT(webvtt);
    // UI
    document.getElementById("duration").innerText=cues[cues.length-1].end.toFixed(2);
}

function playChapter(chnum){
    var ch=cues[chnum];
    console.log(`Playing chapter ${ch.content} (${ch.id}), from ${ch.start} to ${ch.end}.`);
    chname.innerText=ch.content;
    video.setAttribute("data-chapter",ch.id);
    video.currentTime=parseFloat(ch.start);
    video.play();
}

function timeui(){
    curTime.innerText=video.currentTime.toFixed(2);
}

function endChapter(){
    var curChapter=video.getAttribute('data-chapter');
    if( video.currentTime>=parseFloat(cues[curChapter].end) && !video.paused ) video.pause();
}