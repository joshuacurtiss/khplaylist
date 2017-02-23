const os=require("os");
const path=require("path");
const fs=require("fs-extra");
const jQuery=$=require("../bower_components/jquery/dist/jquery");
const ScriptureUtil=require("../bower_components/scripture/ScriptureUtil");
const ScriptureVideoUtil=require("../model/ScriptureVideoUtil");

// Link to main process
const electron=require("electron");
const main=electron.remote.require("./main.js");

var video, $curTime, $chname;
var videopath=os.homedir()+path.sep+(os.type()=="Darwin"?"Movies":"Videos");
var svu=new ScriptureVideoUtil(videopath);
var su=new ScriptureUtil();
var playlist=[];

$(document).ready(()=>{
    console.log("Hello!");
    video=document.getElementById("video");
    $curTime=$(".curTime");
    $chname=$(".chname");

    // Wire up listeners
    video.addEventListener("timeupdate", checkVideo, false);
    video.addEventListener("timeupdate", updateVideoUI, false);
    video.addEventListener("click", toggleVideo, false);
    $(".fullscreenToggle").click(toggleFullscreen);
    $(".powerButton").click(quit);
    
    // TESTING //
    var scriptures=su.parseScriptures("Ruth 2:4; Gen 3:15-16, 22; Rev 21:3, 4");
    scriptures.forEach((s)=>{
        var svideo=svu.createVideo(s);
        playlist.push(svideo);
    });
    playItem(0);
    // END TESTING //

    updateListUI();
    console.log("Initialized!");
});

function updateListUI() {
    for( var i=0 ; i<playlist.length ; i++ ) {
        $(`#fld${i+1}`).val(playlist[i].displayName);
    }
}

function playItem(index) {
    var item=playlist[index];
    console.log(`Playing item ${index} (with ${item.list.length} cues).`);
    video.setAttribute("data-playlist-index",index);
    video.setAttribute("data-cue-index",0);
    video.src=item.path;
    video.currentTime=parseFloat(item.list[0].start);
    video.play();
}

function updateVideoUI(){
    $curTime.text(video.currentTime.toFixed(2));
}

function checkVideo(){
    var curPlaylistIndex=Number(video.getAttribute("data-playlist-index"));
    var curCueIndex=Number(video.getAttribute("data-cue-index"));
    if( curCueIndex>=0 ) {
        var cues=playlist[curPlaylistIndex].list;
        if( video.currentTime>=parseFloat(playlist[curPlaylistIndex].list[curCueIndex].end) ) {
            if( curCueIndex<cues.length-1 ) {
                curCueIndex+=1;
                video.currentTime=parseFloat(cues[curCueIndex].start);
                video.setAttribute("data-cue-index",curCueIndex);
            } else {
                video.pause();
                video.setAttribute("data-cue-index","-1");

                // TESTING: Automatically proceed to next item. //
                if(curPlaylistIndex<playlist.length-1) {
                    setTimeout(`playItem(${curPlaylistIndex+1})`,3000);
                }
                // END TESTING //

            }
        }
    } 
}

function toggleFullscreen(){
    if( $('body').hasClass('fullscreenMode') ) {
        $('body').removeClass('fullscreenMode').addClass('playlistMode');
    } else {
        $('body').removeClass('playlistMode').addClass('fullscreenMode');
    }
}

function toggleVideo(){
    if(!this.paused) this.pause(); else this.play();
}

function quit(){
    main.quit();
}