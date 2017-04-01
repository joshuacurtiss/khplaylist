const expect=require("chai").expect;
const ExternalMediaUtil=require("../model/ExternalMediaUtil");

describe("ExternalMediaUtil", function() {

    describe("parseExternalMedia", function() {
        var tests=[
            {text:"Play C:\\test\\test.png for now", finds:"C:\\test\\test.png"},
            {text:"Try /Users/josh/Pictures/mypic.jpg too", finds:"/Users/josh/Pictures/mypic.jpg"},
            {text:"C:\\mypic.jpg and D:\\my\\other\\pic.gif", finds:"C:\\mypic.jpg; D:\\my\\other\\pic.gif"},
            {text:"C:\\mypic.jpg; D:\\my\\other\\pic.gif", finds:"C:\\mypic.jpg; D:\\my\\other\\pic.gif"},
            {text:"Try \\\\server\\dir\\pic.jpg on networks", finds:"\\\\server\\dir\\pic.jpg"},
            {text:"Videos like c:\\myvid.mp4 work too", finds:"c:\\myvid.mp4"},
            {text:"c:\\myvid.mp4", finds:"c:\\myvid.mp4"}
        ];
        var util=new ExternalMediaUtil();
        tests.forEach(function(test) {
            it(`"${test.text}" should find "${test.finds}"`, function() {
                var result=util.parseExternalMedia(test.text);
                expect(result.map(item=>item.displayName).join("; ")).to.equal(test.finds);
            });
        });
    })

});