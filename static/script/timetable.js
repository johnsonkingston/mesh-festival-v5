function filterTimetable(format,el){
    if($('#filterAll').attr('data-all') == '1'){
        $('#filterAll').attr('data-all','0');
        $('.EventTimetable').hide();
        $('.active').removeClass('active');

    }

    if(el.attr('data-visible') == '1'){
        $('.'+format).show();
        el.addClass('active');
        el.attr('data-visible',0);
    }else{

        $('.'+format).hide();
        el.removeClass('active');
        el.attr('data-visible',1);
    }
    runShrink()
}
function filterTimetableAll(){
    if($('#filterAll').attr('data-all') == '0'){
        $('#filterAll').attr('data-all','1');
        $('#filterAll').addClass('active');
        $('.EventTimetable').show();
        $('.filterpill').removeClass('active');
        $('.filterpill').attr('data-visible',1);
    }
    runShrink();
}


//Layout Operations
let eventsJS = [];
let firstInRow = [];
let EarliestEvent = {};
let LastestEvent = {};
var shrinkHeight = 1.3;
var originalHeight = 7;
var reductionHeight = originalHeight - shrinkHeight;

function getFirstByColumn(){
    firstInRow.length = 0;

    var venueBefore = '';
    var dayBefore = '';
    for (const property in eventsJS) {
        if(venueBefore !== eventsJS[property].venue){
            var venue = eventsJS[property].venue;
            var id = eventsJS[property].id;
            var day = eventsJS[property].day;
            var firstInRowElement = true;
            firstInRow.push({venue,id,day,firstInRowElement});
        }else if(venueBefore !== eventsJS[property].venue || dayBefore !== eventsJS[property].day){
            var venue = eventsJS[property].venue;
            var id = eventsJS[property].id;
            var day = eventsJS[property].day;
            var firstInRowElement = false;
            firstInRow.push({venue,id,day,firstInRowElement});            
        }
        
        venueBefore = eventsJS[property].venue;
        dayBefore = eventsJS[property].day;
    }
    console.log(firstInRow);
}


function getEarliestEvent(){

    EarliestEvent = {
        16: {hour: 100},
        17: {hour: 100},
        18: {hour: 100},
        19: {hour: 100},
        20: {hour: 100}
    };

    for (const property in eventsJS) {
        var day = eventsJS[property].day;

        if(EarliestEvent[day].hour > eventsJS[property].hour){
            var hour = eventsJS[property].hour;
            EarliestEvent[day].hour = parseInt(hour);
    }
    }
    //console.log(EarliestEvent);
}

function getLastestEvent(){
    LastestEvent = {
        16: {hourEnd: 0},
        17: {hourEnd: 0},
        18: {hourEnd: 0},
        19: {hourEnd: 0},
        20: {hourEnd: 0}
    };

    for (const property in eventsJS) {
        var day = eventsJS[property].day;

        if(LastestEvent[day].hourEnd < eventsJS[property].hourEnd ){
            var hourEnd = eventsJS[property].hourEnd;
            LastestEvent[day].hourEnd = parseInt(hourEnd);
        }
    }
    //console.log(LastestEvent);



}




function shrink(){

    var days = [16,17,18,19,20];
    var totalShrink = {
        16: 0,
        17: 0,
        18: 0,
        19: 0,
        20: 0,
        21: 0
    };
    $('.timetableHourline').height(originalHeight+'em');

    for (const keyDay in days) {
        var day = days[keyDay];
        var i = 9; 
        while (i < EarliestEvent[day].hour) {
            $('#timetableHourline'+day+'-'+i).height(shrinkHeight+'em');
            totalShrink[day] += reductionHeight;
            i++;
        }

        var i = 27; 
        while (i >= LastestEvent[day].hourEnd) {
            $('#timetableHourline'+day+'-'+i).height(shrinkHeight+'em');
            totalShrink[day+1] += reductionHeight;
            i--;
        }

        for (const key in firstInRow) {
            if(firstInRow[key].day == day && !firstInRow[key].firstInRowElement){
                topMargin = parseInt($('#Event-'+firstInRow[key].id).attr('data-topedit'))-totalShrink[day];
                $('#Event-'+firstInRow[key].id).attr('data-topedit',topMargin);
            }else if(firstInRow[key].day >= day && firstInRow[key].firstInRowElement){
                topMargin = parseInt($('#Event-'+firstInRow[key].id).attr('data-topedit'))-totalShrink[day];
                $('#Event-'+firstInRow[key].id).attr('data-topedit',topMargin);
            }
        }
    }


    $( '.EventTimetableA').each(function( index ) {      
        $(this).css('margin-top',$(this).attr('data-topedit')+'em');
    });



}

function getElements(){
    eventsJS.length = 0;
    $( '.EventTimetableA').each(function( index ) {
        $(this).css('margin-top',$(this).attr('data-top'));
        $(this).attr('data-topedit',$(this).attr('data-top'));

        if($(this).is(":visible")){
            var day = $(this).attr('data-day');
            var hour = $(this).attr('data-hour');
            var venue = $(this).attr('data-venue');
            var id = $(this).attr('data-id');
            var hourEnd = $(this).attr('data-end');
            eventsJS.push({day,hour,hourEnd,venue,id});
        }

    });
}

function runShrink(){
    getElements();
    getFirstByColumn();
    getEarliestEvent();
    getLastestEvent();
    shrink();
}



$( document ).ready(function() {
    runShrink();


    //Hover fix mobile
    lastTip = null;

    if($(window).width() < $(window).height()){
        
        $( '.timetableSpalte a').each(function( index ) {
            $(this).addEventListener("click", function(e) {
                if(lastTip != e.target) {
                    e.preventDefault();
                    if(lastTip) lastTip.classList.remove("force-tip");
                    lastTip = e.target;
                    lastTip.classList.add("force-tip");
                }
            });
        
        });
    }




});



/* if(mobile) {
    var withtip = document.querySelectorAll(".has-tip");

    for(var i=0; i<withtip.length; ++i) {
        withtip[i].addEventListener("click", function(e) {
            if(lastTip != e.target) {
                e.preventDefault();
                if(lastTip) lastTip.classList.remove("force-tip");
                lastTip = e.target;
                lastTip.classList.add("force-tip");
            }
        });
    }
} */