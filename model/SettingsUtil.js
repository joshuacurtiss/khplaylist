const fs=require("fs-extra");

class SettingsUtil {

    constructor(path) {
        this.path=path;
        Object.assign(this,SettingsUtil.DEFAULTS);
        this.load();
        return this;
    }

    load() {
        try {
            if( this.path.length ) {
                var state=fs.readJsonSync(this.path);
                Object.assign(this,state);
            }
        } catch(e) {}
    }

    save() {
        try {
            if( this.path.length ) {
                var obj={};
                Object.keys(SettingsUtil.DEFAULTS).forEach(key=>obj[key]=this[key]);
                fs.writeJsonSync(this.path,obj);
            }
        } catch(e) {}
    }

}

SettingsUtil.DEFAULTS={
    mode: "playlistMode",
    secondDisplay: false,
    downloadsPath: true,
    extraPath: "",
    cacheMode: "internal"
};

module.exports=SettingsUtil;