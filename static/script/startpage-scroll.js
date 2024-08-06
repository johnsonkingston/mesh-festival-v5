                var positions = [];
                var activeSection;
                var activeFilter1;

                $('main').on( "scroll", function() {    
                    $( "section" ).each(function( index ) {
                        positions[index] = $('body').scrollTop() - $( this ).position().top;
                        if(positions[index] > 0){
                            activeSection = index;
                            activeFilter1 = ((100 - (positions[index] / $('section').first().height() *100)) / 10)+1;
                            activeFilter2 = ((100 - (positions[index] / $('section').first().height() *100)) / 10)+1;
                            activeFilter3 = ((100 - (positions[index] / $('section').first().height() *100)) / 10)+1;
                        }
                    });

                    if($( window ).width() > $( window ).height()){
                        $('#video'+(activeSection+2)).css('display','block');                    
                        //$('#video'+(activeSection+2)).css('filter','brightness('+activeFilter1+')');
                    }
                });
                if($( window ).width() > $( window ).height()){
                    $('#video1').show();
                }