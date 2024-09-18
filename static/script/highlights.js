new Glide('.glide', { autoplay: 2500 }).mount();

function closeHighlight(){
    $('body').css('height','auto');
    $('body').css('overflow','auto');
    $('.glide, .glideclose').fadeOut();
}