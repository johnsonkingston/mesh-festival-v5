function filterTimetable(format,el){
    if(el.attr('data-visible') == '1'){
        $('.'+format).hide();
        el.removeClass('active');
        el.attr('data-visible',0);
    }else{
        $('.'+format).show();
        el.addClass('active');
        el.attr('data-visible',1);
    }
}