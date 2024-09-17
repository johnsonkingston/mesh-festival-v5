function filterTimetable(format,el){
    if($('#filterAll').attr('data-all') == '1'){
        $('#filterAll').attr('data-all','0');
        $('.EventTimetable').hide();
        $('.EventTimetableA').hide();
        $('.active').removeClass('active');

    }
    if(el.attr('data-visible') == '1'){
        $('.'+format).show();
        $('.A'+format).show();
        el.addClass('active');
        el.attr('data-visible',0);
    }else{

        $('.'+format).hide();
        $('.A'+format).hide();
        el.removeClass('active');
        el.attr('data-visible',1);
    }

    runShrink();


    
}

function filterTimetableAll(){
    if($('#filterAll').attr('data-all') == '0'){
        $('#filterAll').attr('data-all','1');
        $('#filterAll').addClass('active');
        $('.EventTimetable').show();
        $('.EventTimetableA').show();
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
var rowWidth = 13;

function getFirstByColumn(){
    firstInRow.length = 0;

    var venueBefore = '';
    var dayBefore = '';
    for (const property in eventsJS) {
        if(venueBefore !== eventsJS[property].venue){
            var venue = eventsJS[property].venue;
            var id = eventsJS[property].id;
            var day = eventsJS[property].day;
            var hour = eventsJS[property].hour;
            var firstInRowElement = true;
            firstInRow.push({venue,id,day,hour,firstInRowElement});
        }else if(venueBefore !== eventsJS[property].venue || dayBefore !== eventsJS[property].day){
            var venue = eventsJS[property].venue;
            var id = eventsJS[property].id;
            var day = eventsJS[property].day;
            var hour = eventsJS[property].hour;
            var firstInRowElement = false;
            firstInRow.push({venue,id,day,hour,firstInRowElement});            
        }
        
        venueBefore = eventsJS[property].venue;
        dayBefore = eventsJS[property].day;
    }
    //console.log(firstInRow);
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

    var emHeight = $('.timetableHourline').height()/7;
    //console.log('emHeight: '+emHeight);

    for (const keyDay in days) {
        var day = days[keyDay];
        
        var i = 9; 
        while (i < EarliestEvent[day].hour) {
            $('#timetableHourline'+day+'-'+i).height(shrinkHeight+'em');
            totalShrink[day] += reductionHeight;
            i++;
        }
        if(EarliestEvent[day].hour == 100){
            totalShrink[day] = 5*reductionHeight;
            totalShrink[day] = 0;
        }

        var i = 27; 
        if(LastestEvent[day].hour !== 0){
            while (i >= LastestEvent[day].hourEnd) {
                $('#timetableHourline'+day+'-'+i).height(shrinkHeight+'em');
                totalShrink[day+1] += reductionHeight;
                i--;
            }
        }

        for (const key in firstInRow) {

                var topMargin = $('#timetableHourline'+firstInRow[key].day+'-'+Math.floor(firstInRow[key].hour)).offset().top-$('#filters').height();
                topMargin = topMargin/emHeight;


            $('#Event-'+firstInRow[key].id).attr('data-topedit',topMargin);
            $('.timetableSpalte'+$('#Event-'+firstInRow[key].id).attr('data-venue')).width(rowWidth+'vw');

        }
    }

    $( '.EventTimetableA').each(function( index ) {   
        var day = $(this).attr('data-day'); 
        var hour =  $(this).attr('data-hour'); 
        var topMargin =  $('#timetableHourline'+day+'-'+Math.floor(hour)).offset().top-$('#filters').height();
        topMargin = topMargin/emHeight;  
        $(this).attr('data-topedit',topMargin);
        $(this).css('top',$(this).attr('data-topedit')+'em');
    });

    $('.timetableSpalte').height($('main').height());

}

function getElements(){
    eventsJS.length = 0;
    $( '.EventTimetableA').each(function( index ) {
        $(this).css('top',$(this).attr('data-top'));
        $(this).attr('data-topedit',$(this).attr('data-top'));

        $('.timetableSpalte').css('width','0');

        if($(this).children('.EventTimetable').is(":visible")){
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

    if(format !== 'none'){
        filterTimetable(format,$('#filter-'+format));
    }

    //Hover fix mobile
    if($(window).width() < $(window).outerHeight()){
        rowWidth = 20;
        $('.timetableSpalte a').each(function( index ) {
            $(this).on( "click", function( event ) {
                event.preventDefault();
                if($(this).hasClass('clicked')){
                    var urlLink = $(this).attr('href');
                    if(urlLink.substr(0,4) !== 'http'){
                        urlLink = baseURL+$(this).attr('href');
                    }
                    location.href = urlLink;
                }else{
                    $('.clicked').removeClass('clicked');
                    $(this).addClass('clicked');
                }
            });
        });
    }
});