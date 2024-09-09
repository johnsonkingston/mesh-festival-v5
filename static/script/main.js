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
        }else if($(this).attr('href').substr(0, 4) !== 'http'){
                $(this).attr('href',baseURL+$(this).attr('href')+'/'+languageShort[languageParameter]);
            }
        
    });
});

//Trennungen
function isOverflown() {
    var elementWidth = $('main').children("h1").first().get(0).scrollWidth;
    var screenWidth = $('main').outerWidth();
    //console.log(elementWidth+' elementWidth / '+screenWidth+' screenWidth');
    if(elementWidth > screenWidth){
        $('main').children("h1").first().css('hyphens','auto');
    }
}

//Ticketopen
function openticket(ticketid,format){
    $('#ticketshop').fadeToggle();
    $('#ticketclose').fadeToggle();
    $('main').toggleClass('blur');
    $('footer').toggleClass('blur');
    $('#navButton').toggle();

    console.log(ticketid);

    if(format == 'show'){
        new ticketpark.Show("#ticketshop",{
            pid: ticketid,
            language: "de",
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
            language: "de",
            customCssFiles: 'https://meshfestival.ch/static/styles/ticket.min.css',
            displayInvitationCodeLink: true,
            texts: {
                "de": { 
                    "invitation_prompt":"Haben Sie einen Einladungscode?",
                    "invitation_link": "Bitte geben Sie ihren Code ein"
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




