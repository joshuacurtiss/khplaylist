const os=require("os");
const path=require("path");
const fs=require("fs-extra");
const ScriptureUtil=require("../bower_components/scripture/ScriptureUtil");
const ScriptureVideoUtil=require("../model/ScriptureVideoUtil");
const jQuery=$=require("../bower_components/jquery/dist/jquery");
require("../bower_components/jquery-ui/jquery-ui");

// Link to main process
const electron=require("electron");
const main=electron.remote.require("./main.js");

var video, $curTime, $chname;
var videopath=os.homedir()+path.sep+(os.type()=="Darwin"?"Movies":"Videos");
var svu=new ScriptureVideoUtil(videopath);
var su=new ScriptureUtil();
var videos={};

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
    $("#playlistContainer input[type=text]")
        .focus(playlistItemFocus)
        .blur(playlistItemBlur)
        .keyup(playlistItemKeypress);
    
    // Playlist sortability
    $("#playlist ol").sortable({
        axis: "y",
        cursor: "-webkit-grabbing",
        handle: ".handle",
        opacity: 0.7,
        revert: true
    });
    
    // TESTING //
    var scriptures=su.parseScriptures("Ruth 2:4; Gen 3:15-16, 22; Rev 21:3, 4");
    scriptures.forEach((s)=>{
        var svideo=svu.createVideo(s);
        videos[svideo.displayName]=svideo;
    });
    //playItem(0);
    // END TESTING //

    updateListUI();
    console.log("Initialized!");
});

function updateListUI() {
    for( var key in videos ){
        var v=videos[key];
        var $item=$(`#playlist li:last`);
        $item.find("input").val(v.displayName);
        addPlaylistRow($item);
    }
}

function selectPlaylistItem(key,start) {
    var item=videos[key];
    if( start==undefined ) start=false;
    if( item ) {
        console.log(`Playing item ${key} (with ${item.list.length} cues).`);
        video.setAttribute("data-video-key",key);
        video.setAttribute("data-cue-index",0);
        video.src=item.path;
        video.currentTime=parseFloat(item.list[0].start);
        if(start) video.play();
    }
}

function updateVideoUI(){
    $curTime.text(video.currentTime.toFixed(2));
}

function checkVideo(){
    var key=video.getAttribute("data-video-key");
    var curCueIndex=Number(video.getAttribute("data-cue-index"));
    if( curCueIndex>=0 ) {
        var v=videos[key];
        if( video.currentTime>=parseFloat(v.list[curCueIndex].end) ) {
            if( curCueIndex<v.list.length-1 ) {
                curCueIndex+=1;
                video.currentTime=parseFloat(v.list[curCueIndex].start);
                video.setAttribute("data-cue-index",curCueIndex);
            } else {
                video.pause();
                video.setAttribute("data-cue-index","-1");

                // TESTING: Automatically proceed to next item. //
                /*
                if(curPlaylistIndex<playlist.length-1) {
                    setTimeout(`playItem(${curPlaylistIndex+1})`,2000);
                }
                */
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

function addPlaylistRow(item) {
    $(`
        <li>
            <span class="handle">&#9776;</span>
            <input type="text" placeholder="Enter scripture or publication reference" />
        </li>
    `)
    .find("input")
        .blur(playlistItemBlur)
        .focus(playlistItemFocus)
        .keyup(playlistItemKeypress)
        .end()
    .insertAfter(item);
}
function playlistItemFocus(){
    $(this).parent().addClass("selected");
    selectPlaylistItem(this.value);
}
function playlistItemBlur(){
    $(this).parent().removeClass("selected");
    parsePlaylistItem(this);
}
function playlistItemKeypress(e){
    var $input=$(e.target);
    var $li=$input.parent();
    var val=$input.val();
    if( e.key=="Enter" ) {
        parsePlaylistItem($input);
        selectPlaylistItem($input.val());
    } else if( val.length>0 && $li.is(":last-child") ) {
        addPlaylistRow($li);
    } else if( val.length==0 && ! $li.is(":last-child") && $li.next().find("input").val().length==0 ) {
        $li.next().remove();
    }
    if( val.length==0 ) $li.removeClass("mediaErr parseErr");
}

function parsePlaylistItem(fld) {
    var txt=$(fld).val();
    var item=null;
    var className="";
    if( txt.length ) {
        var scriptures=su.parseScriptures(txt);
        if( scriptures.length ) {
            item=svu.createVideo(scriptures[0]);
        } 
    }
    // TODO: Note that this will accumulate objects unless there is some kind of 
    // garbage collection or way to delete discarded entries.
    if( item ) {
        videos[item.displayName]=item;
        $(fld).val(item.displayName);
        if( item.list.length==0 ) className="mediaErr";
    }
    else if( $.trim(txt).length ) className="parseErr";
    $(fld).parent().removeClass("mediaErr parseErr").addClass(className);
}

function quit(){
    main.quit();
}