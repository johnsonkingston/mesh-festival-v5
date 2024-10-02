//Colors
const colors = [
    {
        "color1":"215, 255, 0",
        "color2":"140, 110, 255"
    },
    {
        "color1":"255, 145, 120",
        "color2":"120, 150, 120"
    },    
    {
        "color1":"230, 155, 255",
        "color2":"0, 200, 60"
    }
];
const languageShort = ['de','en'];

var currentColor = 0;

function changeColors(){ 
    currentColor++;
    if(currentColor > colors.length-1){
        currentColor = 0;
    }
    $('#footerlogo').attr('src',baseURL+'static/img/mesh-festival'+(currentColor+1)+'.png');
    $('#headerlogo').attr('src',baseURL+'static/img/mesh-festival'+(currentColor+1)+'_top.png');
    $(':root').css('--color1', colors[currentColor].color1);
    $(':root').css('--color2', colors[currentColor].color2);
}

const intervalID = setInterval(changeColors, 10000);





//Links
$( document ).ready(function() {

    $( '.content a').each(function( index ) {

        //Ticketlinks
        if($(this).attr('href').indexOf('ticketshow') !== -1){
            var id = $(this).attr('href').split("ticketshow:")[1];
            id = id.split("/")[0];
            $(this).attr('onclick','openticket("'+id+'","show")');
            console.log(id);
            $(this).removeAttr('href');
        }else if($(this).attr('href').indexOf('ticketid') !== -1){
            var id = $(this).attr('href').split("ticketid:")[1];
            id = id.split("/")[0];
            $(this).attr('onclick','openticket("'+id+'","event")');
            console.log(id);
            $(this).removeAttr('href');
        }



        
    });

    $( '.EventTimetableContent a').each(function( index ) {
        $(this).attr('data-checked',1);

        if($(this).attr('href').substr(0, 4) !== 'http'){
            $(this).attr('href',baseURL+$(this).attr('href')+'/'+languageShort[languageParameter]);
        }    
    });
    



});

//Trennungen
function isOverflown() {
    var elementWidth = $('main').children("h1").first().get(0).scrollWidth;
    var screenWidth = $('main').outerWidth();
    if(elementWidth > screenWidth){
        $('main').children("h1").first().css('hyphens','auto');
    }

    elementWidth = $('main').children("h3").first().get(0).scrollWidth;
    screenWidth = $('main').outerWidth();
    if(elementWidth > screenWidth){
        $('main').children("h3").first().css('hyphens','auto');
    }


}

//Ticketopen
function openticket(ticketid,format){
    $('#ticketshop').fadeToggle();
    $('#ticketclose').fadeToggle();
    $('main').toggleClass('blur');
    $('footer').toggleClass('blur');
    $('#navButton').toggle();
    $('#accessibilityButton').toggle();
    $('body').toggleClass('block');

    console.log(ticketid);

    if(format == 'show'){
        new ticketpark.Show("#ticketshop",{
            pid: ticketid,
            language: language[0],
            customCssFiles: 'https://meshfestival.ch/static/styles/ticket.min.css',
            displayInvitationCodeLink: true,
            texts: {
                "de": { 
                    "invitation_prompt":"Haben Sie einen Einladungscode?",
                    "invitation_link": "Bitte geben Sie ihren Code ein"
                }}
            });
    }else{
        new ticketpark.Auto("#ticketshop",{
            pid: ticketid,
            showFields: ["start", "name", "button"],
            language: language[0],
            customCssFiles: 'https://meshfestival.ch/static/styles/ticket.min.css',
            displayInvitationCodeLink: true,
            texts: {
                "de": { 
                    "invitation_prompt":"Haben Sie einen Einladungscode?",
                    "invitation_link": "Bitte geben Sie ihren Code ein",
                    'title_event': 'Wählen Sie das gewünschte Ticket:'
                }}
            });
    }




}
 
$(window).keydown(function(){
    var x = event.keyCode;
    if (x == 27) {
        openticket();
    }
});



//Cookies

function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}


//Panic Mode
function toggleAccess(){
    var panicCookie = getCookie('panic');
    if (panicCookie) {
        panicModeOff();
    }else
    {
        panicMode();
    }

}


function panicMode(){
    clearInterval(intervalID);
    $(':root').css('--color1', '0,0,0');
    $(':root').css('--color2', '0,0,0');
    $(':root').css('--color3', '255,255,255');

    var cssId = 'myCss'; 
    if (!document.getElementById(cssId))
    {
        var head  = document.getElementsByTagName('head')[0];
        var link  = document.createElement('link');
        link.id   = cssId;
        link.rel  = 'stylesheet';
        link.type = 'text/css';
        link.href = baseURL+'static/styles/panicMode.min.css';
        link.media = 'all';
        head.appendChild(link);
    }
    setCookie('panic','yes',30);
}

function panicModeOff(){
    eraseCookie('panic');
    location.reload();
}

var panicCookie = getCookie('panic');
if (panicCookie) {
    panicMode();
    console.log('Panic Mode enabled!');
}


