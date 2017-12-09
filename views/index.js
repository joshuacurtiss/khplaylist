// Link to main process
const electron=require("electron");
const main=electron.remote.require("./main.js");

// Dependencies
const os=require("os");
const path=require("path");
const fs=require("fs-extra");
const hash=require("string-hash");
const yazl=require("yazl");
const yauzl=require("yauzl");
const progress=require('progress-stream');
const WebVttWrapperController=require("../bower_components/webvtt/wrappers/WrapperController");
const ExternalMedia=require("../model/ExternalMedia");
const ExternalMediaUtil=require("../model/ExternalMediaUtil");
const Scripture=require("../bower_components/scripture/Scripture");
const ScriptureUtil=require("../bower_components/scripture/ScriptureUtil");
const ScriptureVideoUtil=require("../model/ScriptureVideoUtil");
const Reference=require("../bower_components/theoreference/Reference");
const ReferenceUtil=require("../bower_components/theoreference/ReferenceUtil");
const ReferenceVideoUtil=require("../model/ReferenceVideoUtil");
const WebvttCacheManager=require("../model/WebvttCacheManager");
const VideoController=require("../controllers/VideoController");
const SettingsUtil=require("../model/SettingsUtil");
const jQuery=$=require("../bower_components/jquery/dist/jquery");
require("../bower_components/jquery-ui/jquery-ui");
require("../bower_components/jquery-dropdown/jquery.dropdown.min");

// Globals
const APPDATADIR=electron.remote.app.getPath('userData')+path.sep;
const PLAYLISTITEM_CLASSES="mediaErr parseErr parsing new valid";
const FF_SECS=15;
const RW_SECS=5;
var videoController, $curTime, $chname;
var videopath=electron.remote.app.getPath('videos');
var imageTimeout=null, batchEntryTimeout=null, studyTimeout=null;
var settings=new SettingsUtil(APPDATADIR+"state.json");
var videoAppController=new WebVttWrapperController({ffprobe:main.dir+path.sep+"bin"+path.sep+"ffprobe"});
var emu=new ExternalMediaUtil(videoAppController);
var cachemgr=new WebvttCacheManager({
    cacheMode: WebvttCacheManager.CACHEMODES.INTERNAL,
    internalCacheDir: APPDATADIR+"webvttcache",
    patchDir: main.dir+path.sep+"data"+path.sep+"webvttpatches"
});
var svu=new ScriptureVideoUtil([videopath], videoAppController, cachemgr);
var su=new ScriptureUtil();
var rvu=new ReferenceVideoUtil([videopath], videoAppController, cachemgr);
var ru=new ReferenceUtil();

$(document).ready(()=>{
    console.log("Hello!");
    videoController=new VideoController(document.getElementById("video"),document.getElementById("text"));
    $curTime=$(".curTime");
    $chname=$(".chname");

    // Set up basic UI
    $('body').removeClass('fullscreenMode playlistMode').addClass(settings.mode);
    
    // Wire up listeners
    $(window).keydown(windowKeyHandler);
    $(window).keyup(windowKeyHandler);
    videoController.video.addEventListener("timeupdate", checkVideo, false);
    videoController.video.addEventListener("timeupdate", updateVideoUI, false);
    videoController.video.addEventListener("click", toggleVideo, false);
    $(".fullscreenToggle").click(toggleFullscreen);
    $(".settingsButton").click(handleSettings);
    $(".powerButton").click(quit);
    $(".vidbackward").click(prevVideo);
    $(".vidforward").click(nextVideo);
    $(".vidplaypause").click(toggleVideo);
    $(".vidrw").click(rewindVideo);
    $(".vidff").click(fastforwardVideo);
    $("#mnuBrowseExternalMedia").click(browseExternalMedia);
    $("#browseExternalMedia").change(handleBrowseExternalMedia);
    $("#mnuStudy").click(handleStudy);
    $("#mnuBatchEntry").click(handleBatchEntry);
    $("#mnuInsertRow").click(handleInsertRow);
    $("#mnuDeleteRow").click(handleDeleteRow);
    $("#playlistClear").click(handlePlaylistClear);
    $("#playlistSave").click(savePlaylistWithFeedback);
    $("#playlistExport").click(handlePlaylistExport);
    $("#playlistImport").click(handlePlaylistImport);

    // Set External Media filetypes
    var acceptarray=ExternalMedia.IMAGE_EXTENSIONS.concat(ExternalMedia.VIDEO_EXTENSIONS);
    acceptlist=acceptarray.map(ext=>"."+ext).join();
    $("#browseExternalMedia").attr("accept",acceptlist);

    // Dialogs
    $(".dialog form").submit(false);

    // Progress Dialog
    progressDialog=$( "#progressDialog" ).dialog({
        autoOpen: false,
        closeOnEscape: false,
        resizable: false,
        modal: true
    });
    progressBar=$("#progressbar").progressbar();

    // Batch Entry Dialog
    settingsDialog=$( "#settingsDialog" ).dialog({
        autoOpen: false,
        height: $(window).height() * 0.5,
        width: $(window).width() * 0.7,
        modal: true,
        buttons: [
            {
                id: "settingsSave",
                text: "Save",
                click: handleSettingsSave
            },
            {
                id: "settingsCancel",
                text: "Cancel",
                click: function() {
                    settingsDialog.dialog("close");
                }
            }
        ],
        open: function() {
            $("#mode").val(settings.mode);
            $("#secondDisplay").prop("checked",settings.secondDisplay);
        }
    });
    function handleSettings(){
        settingsDialog.dialog("open");
    }
    function handleSettingsSave(){
        settings.mode=$("#mode").val();
        settings.secondDisplay=$("#secondDisplay").prop("checked");
        settings.save();
        settingsDialog.dialog("close");
        checkSecondDisplay();        
    }
  
    // Batch Entry Dialog
    batchEntryDialog=$( "#batchEntryDialog" ).dialog({
        autoOpen: false,
        height: $(window).height() * 0.75,
        width: $(window).width() * 0.8,
        modal: true,
        buttons: [
            {
                id: "batchEntrySubmit",
                text: "Add Items",
                click: handleBatchEntryAdd
            },
            {
                id: "batchEntryCancel",
                text: "Cancel",
                click: function() {
                    batchEntryDialog.dialog("close");
                }
            }
        ],
        open: function() {
            $("#batchEntryDialog textarea").val("");
            parseBatchEntryTextarea();
        }
      });
      $("#batchEntryDialog textarea").keyup(function(){
        clearTimeout(batchEntryTimeout);
        batchEntryTimeout=setTimeout(parseBatchEntryTextarea,800);
    });
    function handleBatchEntry(){
        batchEntryDialog.dialog("open");
    }
    function handleBatchEntryAdd(){
        batchEntryDialog.dialog("close");
        $("#batchEntryDialog ul li").each((index,elem)=>{
            let txt=$(elem).text();
            let $li=$("#playlist .selected");
            let $input=$li.find("input");
            if( $input.val().length ) {
                prependPlaylistRow($li);
                selectPlaylistItem($li.prev());
                $li=$("#playlist .selected");
                $input=$li.find("input");
            }
            $input.val(txt);
            parsePlaylistItem($input);
            if( $li.is(':last-child') ) appendPlaylistRow($li);
            selectPlaylistItem($li.next());
        });
    }

    // Study Dialog
    studyDialog=$( "#studyDialog" ).dialog({
        autoOpen: false,
        height: $(window).height() * 0.85,
        width: $(window).width() * 0.4,
        modal: true,
        buttons: [
            {
                id: "studySubmit",
                text: "Add Items",
                click: handleStudyAdd
            },
            {
                id: "studyCancel",
                text: "Cancel",
                click: function() {
                    studyDialog.dialog("close");
                }
            }
        ],
        open: function() {
            $("#studyText").val("");
            parseStudyText();
        }
      });
      $("#studyDialog input").keyup(function(){
        clearTimeout(studyTimeout);
        studyTimeout=setTimeout(parseStudyText,800);
      });
      function handleStudy(){
          studyDialog.dialog("open");
      }
      function handleStudyAdd(){
          studyDialog.dialog("close");
          $("#studyDialog ul li").each((index,elem)=>{
              let txt=$(elem).text();
              let $li=$("#playlist .selected");
              let $input=$li.find("input");
              if( $input.val().length ) {
                  prependPlaylistRow($li);
                  selectPlaylistItem($li.prev());
                  $li=$("#playlist .selected");
                  $input=$li.find("input");
              }
              $input.val(txt);
              parsePlaylistItem($input);
              if( $li.is(':last-child') ) appendPlaylistRow($li);
              selectPlaylistItem($li.next());
          });
      }
  
    // Dropdown menu customization
    $('#dropdown').on('show', function(event, dropdownData) {
        var $li=$("#playlist .selected");
        if($li.is("li:last-child")) {
            $(this).find(".diabled-for-lastrow").addClass("disabled");
        }
    }).on('hide', function(event, dropdownData) {
        $(this).find("li").removeClass("disabled");
    });

    // Mouse movement handler (for fullscreen mode)
    var uiTimeout, uiStatus=false;
    $(window).mousemove(()=>{
        var currentStatus=uiStatus;
        uiStatus=true;
        if( ! currentStatus ) $(".fullscreenMode.ui").animate({"opacity":0.8},400);
        if(uiTimeout) clearTimeout(uiTimeout);
        uiTimeout=setTimeout(()=>{
            $(".fullscreenMode.ui").animate({"opacity":0},400,()=>{uiStatus=false});
        },2000);
    });

    // Set up and restore playlist
    loadPlaylist();
    
    // Playlist sortability
    $("#playlist ol").sortable({
        axis: "y",
        cursor: "-webkit-grabbing",
        handle: ".handle",
        opacity: 0.7,
        revert: true
    });

    // Select first entry
    selectFirstItem();

    // Handle second display
    checkSecondDisplay();

    // Done!
    console.log("Initialized!");
});

function checkSecondDisplay() {
    if( settings.secondDisplay && videoController.secondWin===undefined ) {
        videoController.secondWin=main.createSecondWin();
    } else if( settings.secondDisplay==false && videoController.secondWin!==undefined ) {
        videoController.secondWin.close();
        videoController.secondWin=undefined;
    }
}

function parseBatchEntryTextarea(){
    var $ul=$("#batchEntryDialog ul");
    var $txt=$("#batchEntryDialog textarea");
    var txt=$txt.val();
    var prevHash=$ul.prop("data-hash");
    var thisHash=hash(txt);
    var lines=txt.split("\n");
    var content="";
    if( thisHash!=prevHash ) {
        for( var line of lines ) {
            line=line.trim();
            let scriptures=su.parseScripturesWithIndex(line);
            let references=ru.parseReferencesWithIndex(line);
            let media=emu.parseExternalMediaWithIndex(line);
            // Combine and sort them according to parse order
            let objs=scriptures.concat(references).concat(media);
            objs.sort((a,b)=>a.index-b.index);
            // Make the text output
            let lineResult=objs.map(item=>item.obj.toString()).join("; ");
            if( lineResult.length )
                content+=`<li>${lineResult}</li>`;
        }
        $ul.prop("data-hash",thisHash).html(content);
    }
    if( $ul.find("li").length ) $("#batchEntrySubmit").prop("disabled",false).removeClass("ui-state-disabled");
    else $("#batchEntrySubmit").prop("disabled",true).addClass("ui-state-disabled");
}

function parseStudyText(){
    var $ul=$("#studyDialog ul");
    var txt=$("#studyDialog input").val().trim();
    var prevHash=$ul.prop("data-hash");
    var thisHash=hash(txt);
    if( thisHash!=prevHash ) {
        let objs=ru.parseReferencesWithIndex(txt);
        if( objs.length ) {
            objs.sort((a,b)=>a.index-b.index);
            objs.forEach(item=>{
                ref=item.obj;
                rvu.createStudyVideos(ref,(err,refvids)=>{
                    var content="";
                    refvids.forEach(refvid=>content+=`<li>${refvid.displayName}</li>`);
                    $ul.prop("data-hash",thisHash).html(content);
                    if( $ul.find("li").length ) $("#studySubmit").prop("disabled",false).removeClass("ui-state-disabled");
                    else $("#studySubmit").prop("disabled",true).addClass("ui-state-disabled");
                });
            });
        } else {
            $ul.prop("data-hash",thisHash).html("");
            if( $ul.find("li").length ) $("#studySubmit").prop("disabled",false).removeClass("ui-state-disabled");
            else $("#studySubmit").prop("disabled",true).addClass("ui-state-disabled");    
        }
    }
}

function selectFirstItem(){
    var $firstli=$("#playlist li:first");
    if( $firstli.hasClass("parsing") ) setTimeout(selectFirstItem,100);
    else selectPlaylistItem($firstli);
}

function handlePlaylistExport() {
    purgeMedia();
    settings.save();
    savePlaylist();
    electron.remote.dialog.showSaveDialog(main.win,{
        title: "Save Playlist",
        defaultPath: "playlist.zip",
        buttonLabel: "Save",
        message: "Please choose a location to save your playlist."
    }, function(filename){
        if( !filename ) return;
        progressDialog.dialog("open");
        progressBar.progressbar("value",false);
        var zip=new yazl.ZipFile();
        // Zip playlist.json
        zip.addFile(APPDATADIR+"playlist.json","playlist.json");
        // Find all valid media files in the ~/data/media directory and add them
        var pathwalk=[];
        var filelen=0;
        var exts=ExternalMedia.IMAGE_EXTENSIONS.concat(ExternalMedia.VIDEO_EXTENSIONS).map(item=>"."+item);
        try {
            pathwalk=fs.walkSync(APPDATADIR+"media");
        } catch(err) {}
        for( var p of pathwalk ) {
            f=path.basename(p);
            ext=path.extname(f).toLowerCase();
            if( exts.indexOf(ext)>=0 ) {
                // Keep track of how many bytes need to be added
                var stat=fs.statSync(p);
                filelen+=stat.size;
                // Add them file
                zip.addFile(p,f,{compress:false});
            }
        }
        // Update the progress bar while the zip pipeline is progressing
        var prog=progress({time:250, length:filelen});
        prog.on("progress", function(progress){
            progressBar.progressbar("value",Math.round(progress.percentage));
        });
        zip.outputStream
            .pipe(prog)
            .pipe(fs.createWriteStream(filename)).on("close", function() {
                // When done, have UI update
                progressBar.progressbar("value",100);
                setTimeout(function(){progressDialog.dialog("close")},900);
            });
        zip.end();
    });
}

function handlePlaylistImport() {
    electron.remote.dialog.showOpenDialog(main.win,{
        title: "Import Playlist",
        buttonLabel: "Import",
        message: "Please choose the playlist you want to import.",
        filters: [{name:'Zip', extensions: ['zip']}]
    }, function(filenames){
        if( !filenames ) return;
        // Start UI for import
        progressDialog.dialog("open");
        progressBar.progressbar("value",false);
        var zipstats=fs.statSync(filenames[0]);
        // Delete existing media
        var pathwalk=[];
        var exts=ExternalMedia.IMAGE_EXTENSIONS.concat(ExternalMedia.VIDEO_EXTENSIONS).map(item=>"."+item);
        try {
            pathwalk=fs.walkSync(APPDATADIR+"media");
        } catch(err) {}
        for( var p of pathwalk ) {
            if( exts.indexOf(path.extname(p).toLowerCase())>=0 ) fs.removeSync(p);
        }
        // Unzip the archive
        yauzl.open(filenames[0], {lazyEntries: true}, function(err, zipfile) {
            if (err) throw err;
            zipfile.readEntry();
            zipfile.on("entry", function(entry) {
                if (/\/$/.test(entry.fileName)) {
                    // Directory entry, skip it.
                    zipfile.readEntry();
                } else {
                    // file entry
                    zipfile.openReadStream(entry, function(err, readStream) {
                        if (err) throw err;
                        readStream.on("end", function() {
                            zipfile.readEntry();
                        });
                        var p=APPDATADIR;
                        if( entry.fileName.toLowerCase()!=="playlist.json" ) p+="media"+path.sep;
                        readStream.pipe(fs.createWriteStream(p+entry.fileName));
                    });
                }
            }).on("end", function(){
                loadPlaylist();
                progressDialog.dialog("close")
            });
        });
    });
}

function loadPlaylist() {
    var playlist=[];
    try {
        playlist=fs.readJsonSync(APPDATADIR+"playlist.json");
    } catch(e) {
        console.log("Error loading playlist. Creating a blank playlist.");
    }
    $("#playlist li").remove();
    appendPlaylistRow();
    for( var item of playlist ) {
        var $li=$("#playlist li:last");
        var $input=$li.find("input");
        $input.val(item.text);
        parsePlaylistItem($input);
        appendPlaylistRow($li);
    }
    purgeMedia();
}

function savePlaylist() {
    var list=[];
    $("#playlist li").each((index,el)=>{
        var txt=$(el).find("input").val();
        if(txt.length) {
            list.push({
                "text": txt
            });
        }
    });
    fs.writeJsonSync(APPDATADIR+"playlist.json",list);
}

function savePlaylistWithFeedback() {
    savePlaylist();
    $("#notificationBanner")
        .html('<i class="fa fa-floppy-o"></i> Playlist saved!')
        .slideDown(800)
        .delay(3000)
        .slideUp(800);
}

function purgeMedia() {
    var pathwalk=[];
    var exts=ExternalMedia.IMAGE_EXTENSIONS.concat(ExternalMedia.VIDEO_EXTENSIONS).map(item=>"."+item);
    console.log("Purging media...");
    try {
        fs.walk(APPDATADIR+"media")
            .on('data', item=>{
                // Collect paths of all valid files (with the right extensions)
                if( exts.includes(path.extname(item.path).toLowerCase()) ) pathwalk.push(item.path);
            })
            .on('end', ()=>{
                // Collect all paths of ExternalMedia objects in the playlist
                var mediaPlaylistPaths=[];
                $("#playlist li").each((i,li)=>{
                    $(li).prop("videos").forEach(vo=>{
                        if( vo instanceof ExternalMedia ) mediaPlaylistPaths.push(vo.path);
                    });
                });
                // Filter out the files that are not in the media playlist and delete them
                pathwalk
                    .filter(path=>!mediaPlaylistPaths.includes(path))
                    .forEach(path=>fs.remove(path));
            });
    } catch(err) {}
}

function mountPlaylistItem(li,index=0,start=false) {
    var $li=$(li);
    var key=$li.find("input").val();
    var videos=$li.prop("videos");
    var item=videos[index];
    if(imageTimeout) clearTimeout(imageTimeout);
    videoController.backgroundImage="none";
    if( item ) {
        pauseVideo();
        console.log(`Mounting #${index} "${item.displayName}" (with ${item.list.length} cues).`);
        $("#text").hide();
        videoController.text="";
        videoController.set("data-video-index",index);
        videoController.set("data-cue-index",item.list.length>=0?0:-1);
		var escapedPath=encodeURI(item.path.replace(/\\/g,"/"))
                .replace("#","%23")
                .replace("(","%28")
                .replace(")","%29");
        if( item.list.length ) {
            if( videoController.src!=`file://${os.type()=="Darwin"?"":"/"}${escapedPath}` ) videoController.src=escapedPath;
            videoController.currentTime=Math.ceil(parseFloat(item.list[0].start)*100)/100;
            if(start) playVideo();
        } else if( item.isImage() ) {
            videoController.src="";
            videoController.currentTime=0;
            videoController.set("data-cue-index",-1); // Set to -1 to keep checkVideo from messing with it.
            videoController.backgroundImage=`url(${escapedPath})`;
            if( videos.length-1>index ) {
                // If there are more items for this playlist item, set timer.
                console.log(`Counting down ${ExternalMedia.IMAGE_DURATION} secs.`)
                imageTimeout=setTimeout(()=>{mountPlaylistItem($li,index+1,true)}, ExternalMedia.IMAGE_DURATION*1000);
            }
        }
    } else {
        console.log(`Nothing found for "${key}". Blanking video.`);
        videoController.src="";
        videoController.currentTime=0;
        videoController.set("data-video-index",-1);
        videoController.set("data-cue-index",-1);
        videoController.text=key;
        $("#text").css("line-height",$(videoController.video).css("height")).show();
    }
    checkControls();
}

function updateVideoUI(){
    $curTime.text(videoController.currentTime.toFixed(2));
}

function checkVideo(){
    var curVideoIndex=Number(videoController.get("data-video-index"));
    var curCueIndex=Number(videoController.get("data-cue-index"));
    if( curCueIndex>=0 && curVideoIndex>=0 ) {
        var $li=$("#playlist li.selected");
        var videos=$li.prop("videos");
        var v=videos[curVideoIndex];
        var endTime=parseFloat((v.list.length>curCueIndex)?v.list[curCueIndex].end:0);
        $("#playlist .selected .progress, .fullscreenMode.progress")
            .css("width",`${calcPlayPercentage(videos,curVideoIndex,curCueIndex,videoController.currentTime)}%`);
        // Take action if video has passed the designated end time.
        // Check only to 2 decimals because some software calculates video duration accurate to 2 decimals only.
        if( videoController.currentTime.toFixed(2)>=endTime ) {
            if( curCueIndex<v.list.length-1 ) {
                curCueIndex+=1;
                console.log("Moving to cue #"+curCueIndex+".");
                videoController.currentTime=Math.ceil(parseFloat(v.list[curCueIndex].start)*100)/100;
                videoController.set("data-cue-index",curCueIndex);
            } else if( curVideoIndex<videos.length-1 ) {
                mountPlaylistItem($li,curVideoIndex+1,true);
            } else {
                pauseVideo();
                videoController.set("data-video-index","-1");
                videoController.set("data-cue-index","-1");
                checkControls();
            }
        }
    }
}

function calcPlayPercentage(videos,videoIndex,cueIndex,pos) {
    var sum=0, cueMax;
    // Calculate sum of all past videos/cues played so far
    for( var vi=0 ; vi<=videoIndex ; vi++ ) {
        if( videos[vi].isImage() ) {
            // If it's an image, just give the image duration constant
            sum+=ExternalMedia.IMAGE_DURATION;
        } else {
            // Otherwise, add all the cues lengths for a given video's list
            cueMax=(vi==videoIndex)?cueIndex:videos[vi].list.length;
            for( ci=0 ; ci<cueMax ; ci++ )
                if( videos[vi].list.length>ci )
                    sum+=videos[vi].list[ci].end-videos[vi].list[ci].start;
        }
    }
    // Now add time for the current video
    if( videos[videoIndex].list.length>cueIndex )
        sum+=pos-videos[videoIndex].list[cueIndex].start;
    // Figure out total play time
    var fullPlayLength=0;
    for( vi=0 ; vi<videos.length ; vi++ ) fullPlayLength+=videos[vi].calcPlayLength();
    // And calculate percentage
    var pct=parseInt(100*sum/fullPlayLength);
    // Protect from math gone wild
    if(pct>100) pct=100; 
    else if( pct<0 ) pct=0;
    return pct;
}


function toggleFullscreen(){
    if( $('body').hasClass('fullscreenMode') ) {
        $('body').removeClass('fullscreenMode').addClass('playlistMode');
    } else {
        $('body').removeClass('playlistMode').addClass('fullscreenMode');
    }
}

function checkControls() {
    var curVideoIndex=Number(videoController.get("data-video-index"));
    var curCueIndex=Number(videoController.get("data-cue-index"));
    var $controls=$("#videoControls .vidff, #videoControls .vidrw, #videoControls .vidplaypause");
    if( curVideoIndex>=0 && curCueIndex>=0 ) $controls.removeClass("disabled");
    else $controls.addClass("disabled");
}

function toggleVideo(){
    if( ! $("#videoControls .vidplaypause").hasClass('disabled') ) {
        if(videoController.video.paused && videoController.video.readyState>2) playVideo();
        else pauseVideo();
    }
}
function playVideo(){
    $("#videoControls .vidplaypause").removeClass("fa-play").addClass("fa-pause");
    videoController.play();
}
function pauseVideo(){
    $("#videoControls .vidplaypause").removeClass("fa-pause").addClass("fa-play");
    videoController.pause();
}
function prevVideo(){
    var $li=$("#playlist .selected");
    if( $li.length==0 ) {
        selectPlaylistItem($("#playlist li:first"));
    } else if( ! $li.is(":first-child") ) {
        selectPlaylistItem($li.prev());
    } else {
        mountPlaylistItem($li);
    }
}
function nextVideo(){
    var $li=$("#playlist .selected");
    if( $li.length==0 ) {
        selectPlaylistItem($("#playlist li:last"));
    } else if( ! $li.is(":last-child") ) {
        selectPlaylistItem($li.next());
    }
}
function rewindVideo(){
    if( ! $("#videoControls .vidrw").hasClass('disabled') ) {
        // TODO: Make this intelligent to know to change cue/video index when rewinding 
        var time=(videoController.currentTime>=RW_SECS)?videoController.currentTime-RW_SECS:0;
        videoController.currentTime=time;
    }
}
function fastforwardVideo(){
    if( ! $("#videoControls .vidff").hasClass('disabled') ) {
        // TODO: Make this intelligent to know to change cue/video index when fast-forwarding 
        var time=(videoController.currentTime<videoController.duration-FF_SECS)?videoController.currentTime+FF_SECS:videoController.duration;
        videoController.currentTime=time;
        checkVideo();
    }
}

function createPlaylistRow() {
    var newli=$(`
        <li class="new">
            <span class="progress"></span>
            <span class="handle">&#9776;</span>
            <input type="text" placeholder="Enter scripture or publication reference" />
            <span class="tag"></span>
            <i data-jq-dropdown="#dropdown" data-horizontal-offset="5" class="fa fa-cog fa-fw menu"></i>
            <i class="fa fa-refresh fa-spin fa-fw loader"></i>
        </li>
    `)
    .prop("videos",[])
    .click(playlistItemFocus)
    .find("input")
        .blur(playlistItemBlur)
        .focus(playlistItemFocus)
        .keyup(playlistItemKeyUp)
        .keydown(playlistItemKeyDown)
    .end();
    return newli;
}
function appendPlaylistRow(item) {
    var newli=createPlaylistRow();
    if( item ) $(newli).insertAfter(item);
    else $("#playlist ol").append(newli);
}
function prependPlaylistRow(item) {
    var newli=createPlaylistRow();
    if( item ) $(newli).insertBefore(item);
    else $("#playlist ol").prepend(newli);
}

function playlistItemFocus(e){
    var $li;
    if( $(this).is("li") ) $li=$(this);
    else $li=$(this).closest("li");
    if( ! $li.hasClass("selected") ) selectPlaylistItem($li);
}
function selectPlaylistItem(li) {
    $(li)
        .parents("ol").find(".selected").removeClass("selected").end().end()
        .addClass("selected")
        .find(".progress").css("width",0).end()
        .find("input").select();
    mountPlaylistItem(li);
}
function playlistItemBlur(){
    parsePlaylistItem(this);
}
function playlistItemKeyDown(e){
    var key=e.key.toLowerCase();
    var $input=$(e.target);
    var $li=$input.parent();
    var val=$input.val();
    var fullSelection=(val==window.getSelection().toString() && val.length>0);
    if( fullSelection && key==" " ) {
        // If text is fully selected and hit spacebar, toggle play/pause.
        toggleVideo();
        return false;
    } else if( fullSelection && key=="f" ) {
        // If text is fully selected and hit "f", toggle fullscreen mode.
        toggleFullscreen();
        return false;
    } else if( (e.key=="Backspace" || e.key=="Delete") && val.length==0 && ! $li.is(":last-child") && $li.parent().find("input:placeholder-shown").length>1 ) {
        // If hit backspace or delete key and field is already empty, delete the row.
        // BUT ONLY IF: You're not the last row, and it isn't the last empty row. 
        // We find empty input boxes using the :placeholder-shown selector, nifty trick.
        handleDeleteRow();
        if( e.key=="Backspace" ) prevVideo(); // Backspace will roll up to next video, otherwise will move onto the field filling the deleted row.
        return false;
    }
}
function playlistItemKeyUp(e){
    var $input=$(e.target);
    var $li=$input.parent();
    var val=$input.val();
    if( e.key=="ArrowUp" ) {
        // Arrow up to previous video
        prevVideo();
        return false;
    } else if( e.key=="ArrowDown" || e.key=="Enter" ) {
        // Arrow down to next video
        nextVideo();
        return false;
    } else if( e.key==" " ) {
        // Just catch this to prevent normal keyup actions below from happening.
        return false;
    } else if( val.length>0 && $li.is(":last-child") ) {
        // If you're typing and this is the last row, add another empty row at end.
        appendPlaylistRow($li);
    } else if( val.length==0 && ! $li.is(":last-child") && $li.next().find("input").val().length==0 ) {
        // Delete nearby empty rows
        $li.next().remove();
    }
    if( ["ArrowLeft","ArrowRight","Shift","Meta","Alt","Control","Escape","Tab"].indexOf(e.key)<0 )
        $li.removeClass(PLAYLISTITEM_CLASSES).addClass("new");
}

function parsePlaylistItem(fld) {
    var txt=$(fld).val();
    var item=null;
    var className="valid";
    var tagText="";
    var tagHint="";
    var $li=$(fld).parent();
    if( txt.length && txt!=$li.prop("data-videos-text") ) {
        // Do initial parsing to create scriptures and references:
        console.log(`Parsing field with "${txt}"...`)
        var scriptures=su.parseScripturesWithIndex(txt);
        var references=ru.parseReferencesWithIndex(txt);
        var media=emu.parseExternalMediaWithIndex(txt);
        // Combine them so we can work on them together
        var objs=scriptures.concat(references).concat(media);
        // Make an array to help with keeping track of the order, which will also
        // double as the "Display Name" array for UI later:
        objs.sort((a,b)=>a.index-b.index);
        var order=objs.map(item=>item.obj.toString());
        // Gather together scriptures and references objects
        var items=[];
        objs.forEach(item=>items.push(item.obj));
        // Loop thru the items and create the video objects
        var videos=new Array(items.length);
        var handler, handlers={"Scripture":svu,"Reference":rvu,"ExternalMedia":emu};
        if( items.length ) {
            $li.addClass("parsing");
            var parseCount=items.length;
            for( var i=0 ; i<items.length ; i++ ) {
                handler=handlers[items[i].constructor.name];
                handler.createVideo(items[i],(err,item)=>{
                    if(err) {
                        // If an error occurs for any parse, mark the playlist row in error.
                        console.log(err);
                        tagText=err.tag;
                        tagHint=err.message;
                        className="mediaErr";
                    } else if( ! Array.isArray(item) && item.isVideo() && item.list.length==0 )  {
                        // If item is delivered but its list of cues is empty, consider it a parse error
                        tagHint="Could not find part of the video.";
                        tagText="Cue not found";
                        className="mediaErr";
                    }
                    // If `item` is an array, its an array of single verse videos for a scripture. This requires more work.
                    // Otherwise, just put the new item in the videos array, given that it has a cue list.
                    if( Array.isArray(item) ) {
                        // Create a scripture object based on the array
                        let itemArrayScripture=new Scripture(item[0].scripture.book,item[0].scripture.chapter);
                        for( let sv of item ) itemArrayScripture.verses.push(sv.scripture.verses[0]);
                        // Find the composite scripture's position in the array of scriptures for this row. Put the array in that position.
                        videos[order.indexOf(itemArrayScripture.toString())]=item;
                    } else if( item.list.length || item.isImage() ) {
                        videos[order.indexOf(item.displayName)]=item;
                    }
                    // Once all videos have been parsed/created, finally do UI handling.
                    if( --parseCount<=0 ) {
                        // Find any "composite scripture" arrays and flatten them out with the rest of the array 
                        for( let pos=0 ; pos<videos.length ; pos++ ) {
                            if( Array.isArray(videos[pos]) )
                                videos.splice(pos,1,...videos[pos]);
                        }
                        // Set all data to the playlist item.
                        $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                            .prop("videos",videos)
                            .prop("data-videos-text",order.join("; "))
                            .find(".tag").text(tagText).attr("title",tagHint).end()
                            .find("input").val(order.join("; ")).end();
                    }
                });
            }
        }
        else if( $.trim(txt).length ) {
            className="parseErr";
            $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                .prop("videos",[])
                .prop("data-videos-text",txt)
                .find(".tag").text(tagText);
        }
    } else if( $.trim(txt).length==0 ) {
        $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
            .prop("videos",[])
            .prop("data-videos-text","")
            .find(".tag").text(tagText);
    }
}

function handlePlaylistClear() {
    if( confirm("Are you sure you want to clear the playlist?") ) {
        $("#playlist li").remove();
        appendPlaylistRow();
        selectFirstItem();
        purgeMedia();
    }
}

function windowKeyHandler(e) {
    var key=e.key?e.key.toLowerCase():"";
    var $targ=$(e.target);
    var cmds={
        "keydown": {
            " ": toggleVideo,
            "q": quit,
            "x": quit,
            "f": toggleFullscreen,
            "escape": toggleFullscreen
        },
        "keyup": {
            "arrowup": prevVideo,
            "arrowdown": nextVideo,
            "arrowleft": rewindVideo,
            "arrowright": fastforwardVideo
        }
    };
    if( $targ.is("input") || $targ.is("textarea") ) {
        return true;
    } else if( cmds[e.type].hasOwnProperty(key) ) {
        e.preventDefault();
        if( key=="escape" && !$("body").hasClass("fullscreenMode") ) return;
        cmds[e.type][key]();
    }
}

function browseExternalMedia() {
    // Just trigger a click of the input[type=file] form element
    $("#browseExternalMedia").trigger("click");
}
function handleBrowseExternalMedia(evt) {
    // Only proceed if a file was passed in
    if( this.files.length ) {
        // Append this to the existing value of selected input
        var $input=$("#playlist li.selected input");
        var data=[];
        var text=$input.val().trim();
        if( text.length ) data.push(text);
        for( var i=0 ; i<this.files.length ; i++ ) data.push(this.files[i].path);
        text=data.join("; ");
        // Focus and trigger keyup event so the form element behaves normally
        $input.val(text).focus().trigger("keyup");
        // Clear the file field's value so the onchange event fires every time
        this.value="";
    }
}
function handleInsertRow(){
    var $li=$("#playlist .selected");
    if( ! $(this).closest("li").hasClass("disabled") ) {
        prependPlaylistRow($li);
        prevVideo();
    }
}
function handleDeleteRow(){
    var $li=$("#playlist .selected");
    if( ! $(this).closest("li").hasClass("disabled") ) {
        nextVideo();
        $li.remove();
        purgeMedia();        
    }
}

function quit(){
    settings.save()
    savePlaylist();
    main.quit();
}