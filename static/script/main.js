const languageShort = ['de','en'];

function toggleFilter() {
    $('#filters .bubble').toggleClass('open');
}

function historyBack() {
    history.back();
}

// CMS rich-text images (.content/.lead): lazy-load them, reserve their layout
// space up front (avoids CLS) using the width/height Directus already encodes
// in the URL from the original upload, and reuse the file library's title -
// auto-filled as alt text by the Directus editor on insert - as a caption.
function captionContentImages(scope) {
    (scope || document).querySelectorAll('.content img, .lead img').forEach(function(img) {
        if (img.dataset.captioned) return;
        img.dataset.captioned = '1';

        img.loading = 'lazy';
        if (!img.getAttribute('width') && !img.getAttribute('height')) {
            try {
                var url = new URL(img.src, window.location.href);
                var w = url.searchParams.get('width');
                var h = url.searchParams.get('height');
                if (w && h) {
                    img.setAttribute('width', w);
                    img.setAttribute('height', h);
                }
            } catch (e) {}
        }

        var alt = (img.getAttribute('alt') || '').trim();
        if (!alt) return;
        var block = img.closest('p') || img.parentElement;
        var caption = document.createElement('p');
        caption.className = 'mediaCaption';
        caption.textContent = alt;
        block.insertAdjacentElement('afterend', caption);
    });
}

function toggleNav() {
    $('#startpageNav').toggleClass('open');
    $('main').toggleClass('blur');
    $('#filters').toggleClass('blur');
    $('footer').toggleClass('blur');
    $('.splashImage').toggleClass('blur');
    $('#hamburger').toggleClass('open');
}

$(window).keydown(function(){
    if (event.keyCode == 27) {
        if ($('#eventOverlay').hasClass('open')) {
            closeEventOverlay();
        } else {
            toggleNav();
        }
    }
});





function initAccordeon() {
    var titles = $('.accordeon-title').toArray();
    var items = $('.accordeon').toArray();
    if (!titles.length) return;

    $(items).hide();

    var groups = titles.map(function(title, i) {
        var nextTitle = titles[i + 1] || null;
        return items.filter(function(item) {
            var afterTitle = !!(title.compareDocumentPosition(item) & 4);
            var beforeNext = !nextTitle || !!(nextTitle.compareDocumentPosition(item) & 2);
            return afterTitle && beforeNext;
        });
    });

    titles.forEach(function(title, i) {
        var group = groups[i];
        $(title).css('cursor', 'pointer').click(function() {
            titles.forEach(function(otherTitle, j) {
                if (j !== i && $(otherTitle).hasClass('open')) {
                    $(groups[j]).slideUp(200);
                    $(otherTitle).removeClass('open');
                }
            });
            $(group).slideToggle(200);
            $(this).toggleClass('open');
        });
    });
}

//Links
$( document ).ready(function() {
    initAccordeon();
    captionContentImages();

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
 





