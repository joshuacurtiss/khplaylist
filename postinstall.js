/**
 * This will download the ffprobe binary for the current
 * platform that is running the script.
 */

const ffbinaries=require('ffbinaries');
const path=require('path');
const fs=require('fs');

function download(callback) {
    var platform=ffbinaries.detectPlatform();
    var dest=__dirname + path.sep + 'bin' + path.sep;
    var binaryfilename='ffprobe'+(platform.substr(0,3)=='win'?'.exe':'');
    if( ! fs.existsSync(dest+binaryfilename) ) {
        ffbinaries.downloadFiles('ffprobe', {destination: dest}, (err, data) => {
            console.log('Downloading ffprobe binary to: '+dest);
            callback(err, data);
        });
    } else {
        console.log(`Binary already exists at ${dest}${binaryfilename}, no action taken!`);
    }
}

download(function(err, data) {
    if (err) {
        console.log('Download failed.', err);
    } else {
        console.log('Download successful.');
    }
});
