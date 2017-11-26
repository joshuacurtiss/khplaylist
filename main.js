const electron = require("electron");
const {app, BrowserWindow} = electron;

app.on("ready", () => {
    var videoWin=new BrowserWindow({frame:false, fullscreen:true});
    videoWin.loadURL(`file://${__dirname}/views/index.html`);
    exports.win=videoWin;
    //videoWin.webContents.openDevTools();   // Opening the dev tools
});

exports.dir=__dirname;

exports.quit=()=>{
    app.quit();
}