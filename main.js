const electron = require("electron");
const {app, BrowserWindow} = electron;

app.on("ready", () => {
    var videoWin=new BrowserWindow({width:900, height:600, frame:false, fullscreen:true});
    videoWin.loadURL(`file://${__dirname}/views/index.html`);
    //videoWin.webContents.openDevTools();   // Opening the dev tools
});

exports.quit=()=>{
    app.quit();
}