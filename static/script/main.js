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
    $(':root').css('--color1', colors[currentColor].color1);
    $(':root').css('--color2', colors[currentColor].color2);

    currentColor++;
    if(currentColor > colors.length-1){
        currentColor = 0;
    }
}

const intervalID = setInterval(changeColors, 10000);


//Links
$( document ).ready(function() {
    $( '.content a').each(function( index ) {
        if($(this).attr('href').substr(0, 4) !== 'http'){
            console.log(baseURL+$(this).attr('href')+'/'+languageShort[languageParameter]);
        }
        
    });
});
