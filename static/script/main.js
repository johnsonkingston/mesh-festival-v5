const languageShort = ['de','en'];

function toggleNav() {
    $('#startpageNav').toggleClass('open');
    $('main').toggleClass('blur');
    $('#filters').toggleClass('blur');
    $('footer').toggleClass('blur');
    $('#hamburger').toggleClass('open');
    

}





//Links
$( document ).ready(function() {

     $('.logobannerInner').each(function( index ) {
        $(this).clone().appendTo($(this).parent()).addClass('clone');
        $(this).clone().appendTo($(this).parent()).addClass('clone');
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
function openticket(ticketid,format,invitation){
    $('#ticketshop').fadeToggle();
    $('#ticketclose').fadeToggle();
    $('main').toggleClass('blur');
    $('footer').toggleClass('blur');
    $('body').toggleClass('block');

    console.log(ticketid);

    if(format == 'show'){
        if(invitation === false){
            new ticketpark.Show("#ticketshop",{
                pid: ticketid,
                language: language[0],
                customCssFiles: 'https://meshfestival.ch/static/styles/ticket.min.css',
                texts: {
                    "de": { 
                        "invitation_prompt":"Haben Sie einen Einladungscode?",
                        "invitation_link": "Bitte geben Sie ihren Code ein"
                    }}
                });
        }else{
            console.log(invitation+' : '+format);
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
        }

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





