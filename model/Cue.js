class Cue {

    constructor(start,end,content,id) {
        this.start=start;
        this.end=end;
        this.min=start;
        this.max=end;
        this.content=content;
        if(id) this.id=id;
        return this;
    }

}

module.exports=Cue;