// Link to main process
const electron=require("electron");
const main=electron.remote.require("./main.js");

// Dependencies
const chokidar=require('chokidar');
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
const STUDY_PAR_END_TRIM=1.5;
var videoController, $curTime, $chname;
var videopaths=[];
var imageTimeout=null, batchEntryTimeout=null, studyTimeout=null;
var settings=new SettingsUtil(APPDATADIR+"state.json");
var videoAppController, cachemgr, videopathWatcher, svu, rvu, emu;
var su=new ScriptureUtil();
var ru=new ReferenceUtil();

$(document).ready(()=>{
    console.log("Hello!");
    videoController=new VideoController(document.getElementById("video"),document.getElementById("text"));
    $curTime=$(".curTime");
    $chname=$(".chname");
    
    // Setup splash
    $("#splash .splashprogress").progressbar({value:false});

    // Set up video app controller and index of video and webvtt files
    videoAppController=new WebVttWrapperController({ffprobe:path.join(main.dir,"bin","ffprobe"+(os.type()=="Windows_NT"?".exe":""))});
    indexVideos();
    videopathWatcher=chokidar.watch(videopaths, {awaitWriteFinish:true, ignorePermissionErrors:true, ignoreInitial:true});
    videopathWatcher
        .on('ready', ()=>console.log("Watcher is ready, looking for changes in directories."))
        .on('add', newpath => {
            console.log(`${newpath} added.`);
            rvu.addVideo(newpath);
            svu.addVideo(newpath);
            emu.addMedia(newpath);
            // Find playlist items in err state and re-parse.
            $("#playlist li.mediaErr").each(function(){
                $(this).prop("data-videos-text","");
                parsePlaylistItem($(this).find("input"));
            });
        })
        .on('unlink', oldpath => {
            console.log(`${oldpath} removed.`);
            rvu.removeVideo(oldpath);
            svu.removeVideo(oldpath);
            emu.removeMedia(oldpath);
            // Find playlist items that use this video and re-parse.
            $("#playlist li.valid").each(function(){
                if( $(this).prop("videos").findIndex(vid=>vid.path==oldpath) >= 0 ) {
                    $(this).prop("data-videos-text","");
                    parsePlaylistItem($(this).find("input"));
                }
            });
        });
  
    // Wire up listeners
    $(window).keydown(windowKeyHandler);
    $(window).keyup(windowKeyHandler);
    videoController.video.addEventListener("timeupdate", checkVideo, false);
    videoController.video.addEventListener("timeupdate", updateVideoUI, false);
    videoController.video.addEventListener("click", toggleVideo, false);
    $(".fullscreenToggle").click(toggleFullscreen);
    $(".secondButton").click(toggleSecondDisplay);
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
    $("#extraPathBrowse").click(handleSettingsExtraPathBrowse);
    $("#extraPathClear").click(handleExtraPathClear);
    $("#cacheMode").change(handleCacheMode);
    $("#clearCache").click(handleClearCache);

    // Set External Media filetypes
    $("#browseExternalMedia").attr("accept",ExternalMedia.ALLEXT.join());

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
        height: $(window).height() * 0.8,
        width: $(window).width() * 0.4,
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
            $("#downloadsPath").prop("checked",settings.downloadsPath);
            $("#extraPath").val(settings.extraPath);
            var cacheModeHtml="";
            Object.values(WebvttCacheManager.CACHEMODES).forEach(cachemode=>cacheModeHtml+=`<option value="${cachemode.id}">${cachemode.name}</option>`)
            $("#cacheMode")
                .html(cacheModeHtml)
                .val(settings.cacheMode);
            handleCacheMode();
        }
    });
    function handleSettings(){
        settingsDialog.dialog("open");
    }
    function handleSettingsSave(){
        settings.mode=$("#mode").val();
        settings.secondDisplay=$("#secondDisplay").prop("checked");
        settings.downloadsPath=$("#downloadsPath").prop("checked");
        settings.extraPath=$("#extraPath").val();
        settings.cacheMode=$("#cacheMode").val();
        settings.save();
        settingsDialog.dialog("close");
        indexVideos();
        checkSecondDisplay();
        // TODO: The videopathWatcher should be updated accordingly. 
    }
    function handleSettingsExtraPathBrowse(){
        electron.remote.dialog.showOpenDialog(main.win,{
            title: "Select Directory",
            buttonLabel: "Select",
            message: "Please choose a directory.",
            properties: ['openDirectory','createDirectory']
        }, function(dir){
            $("#extraPath").val(dir?dir[0]:"");
        });
    }
    function handleExtraPathClear(){
        $("#extraPath").val("");
    }
    function handleCacheMode(){
        var id=$("#cacheMode").val();
        var cachemode=Object.values(WebvttCacheManager.CACHEMODES).find(cm=>cm.id==id);
        $("#cacheModeDesc").html(cachemode.desc);
        $("#clearCache").attr("disabled",id!=settings.cacheMode || id==WebvttCacheManager.CACHEMODES.NONE.id);
    }
    function handleClearCache() {
        var cacheModeId=$("#cacheMode").val();
        if( cacheModeId!=WebvttCacheManager.CACHEMODES.NONE.id && confirm(`Delete ${cacheModeId} cache?`) ) {
            cachemgr.purgeWebvttFiles();
        }
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
          var $li=$("#playlist .selected");
          $("#studyDialog ul li").each((index,elem)=>{
              let txt=$(elem).text();
              let $input=$li.find("input");
              if( $input.val().length ) {
                  prependPlaylistRow($li);
                  $li=$li.prev();
                  $input=$li.find("input");
              }
              $input.val(txt);
              parsePlaylistItem($input,function (err,$li){
                if( $li ) {
                    let videos=$li.prop("videos");
                    if( videos.length==1 ) {
                        let video=videos[0];
                        if( video.list.length==1 && 
                            video.list[0].content.toLowerCase().substr(0,2)=="p " &&
                            video.list[0].end-STUDY_PAR_END_TRIM>video.list[0].start ) {
                            console.log(`Adjusting time for "${video.displayName}" (${video.list[0].start}-${video.list[0].end}) by ${STUDY_PAR_END_TRIM} sec.`);
                            video.list[0].end-=STUDY_PAR_END_TRIM;
                            $li.prop("data-source","media");
                        } 
                    }
                }
              });
              if( $li.is(':last-child') ) appendPlaylistRow($li);
              $li=$li.next();
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
        if( $("body").hasClass("fullscreenMode") ) {
            var currentStatus=uiStatus;
            uiStatus=true;
            if( ! currentStatus ) $(".fullscreenMode.ui").animate({"opacity":0.7},400);
            if(uiTimeout) clearTimeout(uiTimeout);
            uiTimeout=setTimeout(()=>{
                $(".fullscreenMode.ui").animate({"opacity":0},400,()=>{uiStatus=false});
            },2000);
        }
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

    // Display version
    $(".version").html(main.version);
    $(".titleBanner img").attr("title",main.version);

    // Remove splash screen and finish up
    setTimeout(function(){
        $('body').removeClass('fullscreenMode playlistMode splashMode').addClass(settings.mode);
        selectFirstItem();
        checkSecondDisplay();
    },1500);

    // Done!
    console.log("Initialized!");
});

function indexVideos() {
    // Accumulate video paths
    videopaths=[electron.remote.app.getPath('videos')];
    if( settings.downloadsPath ) videopaths.push(electron.remote.app.getPath('downloads'));
    if( settings.extraPath.length ) videopaths.push(settings.extraPath);
    // Initialize Webvtt Cache Manager
    cachemgr=new WebvttCacheManager({
        // Pass in the video paths as webvttpaths if cache mode is "external".
        webvttpaths: settings.cacheMode===WebvttCacheManager.CACHEMODES.EXTERNAL.id?videopaths:[],
        cacheMode: settings.cacheMode,
        internalCacheDir: APPDATADIR+"webvttcache",
        patchDir: path.join(main.dir,"data","webvttpatches")
    });
    // Instantiate objects with those paths
    svu=new ScriptureVideoUtil(videopaths, videoAppController, cachemgr);
    rvu=new ReferenceVideoUtil(videopaths, videoAppController, cachemgr);
    emu=new ExternalMediaUtil(videopaths, videoAppController);
    // Purge old webvtt files
    cachemgr.purgeOldWebvttFiles(svu.videos);
    // Re-parse any erring playlist rows
    $("#playlist li.mediaErr").each(function(){
        $(this).prop("data-videos-text","");
        parsePlaylistItem($(this).find("input"));
    });
}

function toggleSecondDisplay() {
    settings.secondDisplay = ! $(".secondButton").hasClass("selected");
    checkSecondDisplay();
}

function checkSecondDisplay() {
    if( settings.secondDisplay ) $(".secondButton").addClass("selected");
    else $(".secondButton").removeClass("selected")
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
        try {
            pathwalk=fs.walkSync(APPDATADIR+"media");
        } catch(err) {}
        for( var p of pathwalk ) {
            f=path.basename(p);
            ext=path.extname(f).toLowerCase();
            if( ExternalMedia.ALLEXT.indexOf(ext)>=0 ) {
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
        try {
            pathwalk=fs.walkSync(APPDATADIR+"media");
        } catch(err) {}
        for( var p of pathwalk ) {
            if( ExternalMedia.ALLEXT.indexOf(path.extname(p).toLowerCase())>=0 ) fs.removeSync(p);
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

/*
 *  Playlist Information:
 * 
 *  "source": "text" to literally just reparse the raw text.
 *            "media" to rely on specific media definitions.
 * 
 *  A "media" array will have objects with the keys:
 * 
 *     "displayName": What text appears in the field
 *     "source": Text to parse the scripture/reference/externalmedia, to find the right file.
 *     "list": Array of cues, which will overwrite the generated list on instantiation.
 * 
 */

function loadPlaylist() {
    var playlist=[];
    try {
        playlist=fs.readJsonSync(APPDATADIR+"playlist.json");
    } catch(e) {
        console.log("Error loading playlist. Creating a blank playlist.");
    }
    $("#playlist li").remove();
    appendPlaylistRow();
    // Loop over the saved playlist
    for( var item of playlist ) {
        // For each item, grab the last playlist row and add the video to it.
        // This has async calculations so this way is async-safe.
        var $li=$("#playlist li:last");
        loadPlaylistRow($li,item);
    }
}

function loadPlaylistRow($li,item) {
    // Immediately add a row after this one, since we're using this one.
    appendPlaylistRow($li);
    var $input=$li.find("input");
    if( item.source===undefined ) item.source="text";
    if( item.text===undefined ) item.text="";
    if( item.source=="text" || ! Array.isArray(item[item.source]) ) {
        // Just load the text and parse fresh.
        $input.val(item.text);
        parsePlaylistItem($input);
    } else {
        // Load exact specs
        var videos=new Array(item[item.source]);
        var className="valid";
        var tagText="";
        var tagHint="";
        if( item[item.source].length==0 ) className="parseErr";
        if( item[item.source] ) {
            item[item.source].forEach((itemObj,itemIndex)=>{
                // Try parsing all types to figure out what kind of object it is.
                var handlers={"Scripture":svu,"Reference":rvu,"ExternalMedia":emu};
                var scriptures=su.parseScriptures(itemObj.source);
                var references=ru.parseReferences(itemObj.source);
                var media=emu.parseExternalMedia(itemObj.source);
                var objs=scriptures.concat(references).concat(media);
                // Only proceed if an object was found out of the source info.
                if( objs.length ) {
                    // Get the right handler based on the type of instantiated object
                    var handler=handlers[objs[0].constructor.name];
                    // Ask the handler to make the video object for this object.
                    handler.createVideo(objs[0],(err,thisvid)=>{
                        if(err) {
                            // If an error occurs, mark the playlist row in error.
                            console.log(err);
                            tagText=err.tag;
                            tagHint=err.message;
                            className="mediaErr";
                            thisvid=undefined;
                        } else if( thisvid.isVideo() && thisvid.list.length==0 ) {
                            // Handle media errs (No cues generated)
                            tagHint="Could not find part of the video.";
                            tagText="Cue not found";
                            className="mediaErr";
                            thisvid=undefined;
                        } else {
                            // All is well. Immediately overwrite the calculated cue list with saved cue list.
                            thisvid.list=itemObj.list;
                        }
                        // Add to list of videos
                        videos[itemIndex]=thisvid;
                        // Once we've processed all videos, update the playlist row UI.
                        if( videos.every(v=>v!==null) ) {
                            console.log(videos);
                            $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                            .prop("videos",videos)
                            .prop("data-source",item.source)
                            .prop("data-videos-text",item.text)
                            .find(".tag").text(tagText).attr("title",tagHint).end()
                            .find("input").val(item.text).end();                                        
                        }
                    });
                }
            });
        }
    }
}
function savePlaylist() {
    var list=[];
    // Loop over every playlist item
    $("#playlist li").each((index,el)=>{
        $li=$(el);
        var txt=$li.find("input").val();
        var source=$li.prop("data-source");
        // Only save if it has content
        if( txt.length ) {
            var obj={"source": source, "text": txt};
            // Only output "media" info if it is being used
            if( source=="media" ) {
                obj[source]=$li.prop("videos").map(video=>{
                    return {
                        "displayName": video.displayName,
                        "source": video.source.toString(),
                        "list": video.list
                    }
                });
            }
            list.push(obj);
        }
    });
    fs.writeJsonSync(APPDATADIR+"playlist.json",list);
}

function savePlaylistWithFeedback() {
    savePlaylist();
    $("#notificationBanner")
        .html('<i class="fa fa-floppy-o"></i> Playlist saved!')
        .show("drop",{direction:"up"},400)
        .delay(3500)
        .hide("drop",{direction:"up"},400);
}

function purgeMedia() {
    var pathwalk=[];
    console.log("Purging media...");
    try {
        fs.walk(APPDATADIR+"media")
            .on('data', item=>{
                // Collect paths of all valid files (with the right extensions)
                if( ExternalMedia.ALLEXT.includes(path.extname(item.path).toLowerCase()) ) pathwalk.push(item.path);
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
    } else if( (e.key=="Backspace" || e.key=="Delete") && val.length==0 && $li.parent().find("input:placeholder-shown").length>1 ) {
        // If hit backspace or delete key and field is already empty, delete the row.
        // BUT ONLY IF it isn't the last empty row. Find empty input boxes using :placeholder-shown selector, nifty trick.
        if( $li.is(":last-child") ) {
            // If it's the last item, only delete if prev one is also empty. We always want the last playlist item to be blank.
            var $prev=$li.prev();
            if( $prev && $prev.find("input").val().length==0 ) {
                handleDeleteRow();
                selectPlaylistItem($prev)
            }
        } else {
            handleDeleteRow();
            if( e.key=="Backspace" ) prevVideo(); // Backspace will roll up to next video, otherwise will move onto the field filling the deleted row.
        }
        return false;
    } else if( e.key=="Enter" ) {
        // Let the keyup handler take care of it.
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
        // If hitting enter on the last entry, create a new playlist item
        if( e.key=="Enter" && $li.is(":last-child") ) appendPlaylistRow();
        // Arrow down to next video
        nextVideo();
        return false;
    } else if( e.key==" " ) {
        // Just catch this to prevent normal keyup actions below from happening.
        return false;
    } else if( val.length>0 && $li.is(":last-child") ) {
        // If you're typing and this is the last row, add another empty row at end.
        appendPlaylistRow($li);
    }
    if( ["ArrowLeft","ArrowRight","Shift","Meta","Alt","Control","Escape","Tab"].indexOf(e.key)<0 ) 
        $li.removeClass(PLAYLISTITEM_CLASSES).addClass("new").prop("data-videos-text","");
}

function parsePlaylistItem(fld,cb) {
    var txt=$(fld).val().trim();
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
                            .prop("data-source","text")
                            .prop("data-videos-text",order.join("; "))
                            .find(".tag").text(tagText).attr("title",tagHint).end()
                            .find("input").val(order.join("; ")).end();
                        // Make callback
                        if( cb ) cb(null,$li);
                    }
                });
            }
        }
        else if( txt.length ) {
            className="parseErr";
            $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
                .prop("videos",[])
                .prop("data-source","text")
                .prop("data-videos-text",txt)
                .find(".tag").text(tagText);
            // Make callback
            if( cb ) cb("parseErr",null);
        }
    } else if( txt.length==0 ) {
        $li .removeClass(PLAYLISTITEM_CLASSES).addClass(className)
            .prop("videos",[])
            .prop("data-source","text")
            .prop("data-videos-text","")
            .find(".tag").text(tagText);
        // Make callback
        if( cb ) cb("empty",null);
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
    videopathWatcher.close();
    settings.save();
    savePlaylist();
    main.quit();
}