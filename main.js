// Libraries
const electron=require("electron");
const {app, BrowserWindow}=electron;
const fs=require("fs-extra");
const path=require("path");

// Constants
const APPDATADIR=app.getPath('userData')+path.sep;

app.on("ready", () => {

    // Init app data directories
    fs.ensureDirSync(APPDATADIR+"media");
    fs.ensureDirSync(APPDATADIR+"webvttcache")
    
    // Create playlist window
    var videoWin=new BrowserWindow({frame:false, fullscreen:true});
    videoWin.loadURL(`file://${__dirname}/views/index.html`);
    exports.win=videoWin;

});

exports.dir=__dirname;

exports.quit=()=>{
    app.quit();
}