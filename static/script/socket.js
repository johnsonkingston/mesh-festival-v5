const socket = io();

var currentMembers = [];
var fixedElements = [];
var fixedElementsXTranslate = 0;
var padding;
var subtitles = [];
var windowWidth = $(window).width();
var windowHeight = $(window).outerHeight();

var emojiIdGuest;
var emojiIdSelf;

var id;
var idSelf = socket.id;

var currentMousePos = { id: idSelf, x: -1, y: -1 };

var emojis = ['❤️','🧶','👂','👃🏿','🧵','🥢','🧠','🕶️','🦍','⚡️','🌎','🥄','🍸','🍴','🧂','🎲','⌚️','🕹️','🎥','🎛️','🔦','💶','⛏️','🔨','🔧','⚖️','🧲','🪓','🔮','🔭','🔬','🧹','🗑️','📎','📐','📏','🖋️','🖊️','🔍'];


function newJoin(data){
    //console.log(data.id+' joined!');
    currentMembers[data.id] = data.id;
    id = data.id;

    idSelf = socket.id;

    var emojiId = Math.floor(Math.random() * emojis.length);

    if(id !== idSelf){
        $('body').append('<div class="cursor" id="'+data.id+'" data-id="'+emojiId+'" onmouseover="meeting(this)">'+emojis[emojiId]+'</div>');
    }else{
        $('body').append('<div class="cursor" id="'+data.id+'" data-id="'+emojiId+'">'+emojis[emojiId]+'</div>');
    }

    //$('#status').html('<div class="status">'+data.id.substr(0,4).toUpperCase()+' joined!</div>');
    $('#members').append('<div class="member" id="member'+data.id+'">'+data.id.substr(0,4).toUpperCase()+'</div>');

    // setTimeout(() => {
    //     clearStatus();
    // }, "2000");
}

// function clearStatus(){
//     $('#status').html('');
// }





$(document).mousemove(function(event) {
    currentMousePos.x = (event.clientX+10)/windowWidth;
    currentMousePos.y = (event.clientY+10)/windowHeight;
    socket.emit('move',currentMousePos);
});  

socket.on('moveTo', function(data){
    if(data.id in currentMembers){
        $('#'+data.id).css('left',data.x*windowWidth);
        $('#'+data.id).css('top',data.y*windowHeight);      
    }else{
        newJoin(data);
    }
});

function removeItem(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
  }


socket.on('left', function(data){
    console.log(data+' left!');
    //$('#status').html('<div class="status">'+data.substr(0,4).toUpperCase()+' left!</div>');
    $('#'+data).remove();
    $('#member'+data).remove();
    //console.log(currentMembers);
    removeItem(currentMembers, data);
    // setTimeout(() => {
    //     clearStatus();
    // }, "2000");
});

function sendJoined(){
    socket.emit('move',0);
}
sendJoined();
setInterval(sendJoined, 2000);


function meeting(element){
    emojiIdGuest = $(element).attr('data-id');
    emojiIdSelf = $('#'+idSelf).attr('data-id');

    var meetingPoint = {};
    meetingPoint.x = parseInt($(element).css('left'))/windowWidth;
    meetingPoint.y = parseInt($(element).css('top'))/windowHeight;

    socket.emit('meeting', meetingPoint);
}

socket.on('meetingSend', function(data){
    var meetingID = new Date().getTime();
    $('body').append('<div class="meetingPoint" id="meet_'+meetingID+'" style="left:'+data.x*100+'vw;top:'+data.y*100+'vh;"></div>');
    
    const intervalID = setInterval(emojiFly, 250, 'meet_'+meetingID,emojiIdGuest, emojiIdSelf);

    setTimeout(() => {
        clearTimeout(intervalID);
    }, "1000");

    // setTimeout(() => {
    //     $('#meet_'+meetingID).fadeOut( "slow", function() {
    //         $('#meet_'+meetingID).remove();
    //     });
    //   }, "10000");
});

function  emojiFly(divID,id1,id2){
    if(Math.random() > 0.5){
        emojiPrint = emojis[id1];
    }else{
        emojiPrint = emojis[id2];
    }
    if(emojiPrint !== undefined){
        $('#'+divID).append('<div class="emoji" style="margin-left: '+(Math.floor(Math.random() * 60) - 30)+'px;">'+emojiPrint+'</div>');
    }
}