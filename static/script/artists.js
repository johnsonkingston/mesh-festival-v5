function filterTimetable(format,el){
    if($('#filterAll').attr('data-all') == '1'){
        $('#filterAll').attr('data-all','0');
        $('.artistLine').hide();
        $('.artistLine').hide();
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
    
}

function filterTimetableAll(){
    if($('#filterAll').attr('data-all') == '0'){
        $('#filterAll').attr('data-all','1');
        $('#filterAll').addClass('active');
        $('.artistLine').show();
        $('.filterpill').removeClass('active');
        $('.filterpill').attr('data-visible',1);
    }
}


$( document ).ready(function() {



});