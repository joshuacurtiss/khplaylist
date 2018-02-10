# Kingdom Hall Playlist #

An app that helps you build a media playlist to facilitate more convenient and expedient playing of media during the meeting, particularly for ASL congregations since publication references and scriptures are played during the meeting program.

This is especially intended for congregations with Windows computers, since they cannot use SL Studio and the native JW app does not yet support playlists. 

## In summary, how does it work? ##

KH Playlist is not intended to compete with or replace the JW "orange" app, and in fact works jointly with it. Use the JW app to download all the required media (songs, publication or Bible chapters, etc), then launch the KH Playlist app and it will utilize the media library within the JW app to play the videos. The video cues embedded in the video files are used to find a given verse or paragraph in the video.

Alternatively, you can download videos from [jw.org](https://www.jw.org/ase/publications) and save them in any folder within your user account's video directory; on Windows it will be named "Videos" and on Macs it will be named "Movies".

For more usage information, view the [KH Playlist](http://www.curtiss.me/khplaylist/) web page.

## How do I compile it myself? ##

The application runs on [Node.js](https://nodejs.org) and [Electron](https://electronjs.org), and is compatible with Mac and Windows. To compile it, you will need Node.js and Yarn installed.

After you download or clone the source, install all dependencies and run the build script. It is named `build-installer-win` for Windows and `build-installer-mac` for Mac. For instance, to build for Windows:

```
yarn install
yarn build-installer-win
```

It will place a compiled executable for your system architecture into a directory in the `builds` directory, as well as an installer file (Setup.exe for Windows, `dmg` file for Mac). 
