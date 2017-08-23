/**
 * This will download the ffprobe binary for the current
 * platform that is running the script.
 */

const ffbinaries=require('ffbinaries');

function download(callback) {
    var dest = __dirname + '/bin';
    var platform = ffbinaries.detectPlatform();
    ffbinaries.downloadFiles(['ffprobe'], {quiet: true, destination: dest}, function (err, data) {
        console.log('Downloading ffprobe binary to '+dest+'.');
        console.log('err', err);
        console.log('data', data);
        callback(err, data);
    });
}

download(function(err, data) {
    if (err) {
        console.log('Downloads failed.');
    } else {
        console.log('Downloads successful.');
    }
});
