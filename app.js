const express = require("express");
const app = express();
const serverPort = 8080;

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

app.use(express.json({extended: true}));
var bodyParser = require('body-parser');

app.use(bodyParser.json());     
app.use(express.urlencoded());

app.use('/static', express.static('static'));
app.use('/static/lang', express.static('lang'));
app.use('/static/includes', express.static('includes'));

const fs = require('fs');
var path = require('path');
var glob = require( 'glob' );

app.engine('pug', require('pug').__express)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');


//Start Server  
const server = app.listen(serverPort, () => {
    console.log('App running on port '+serverPort);
});



//Language
function languageTransform(string){
    if(string == 'en'){
        return 1;
    }else{
        return 0;
    }
}

function langRemove(pathname){
    if(pathname.substr(pathname.length - 3) == '/en' || pathname.substr(pathname.length - 3) == '/de' ){
        return pathname.substring(1,pathname.length - 3);
    }else{
        return pathname.substring(1,pathname.length);
    }
}


//Navigation
async function getNavigation() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Navigation_translations");

    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        return data;
    }
}

//News
async function getNews() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/News?fields[]=*.*");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        return data;
    }
}

//Footer
async function getFooter() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Footer_translations");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        return data;
    }
}







//Timetable
async function getAllEvents() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Navigation_translations");
    const data = await response.json();
    return data;
}

app.get("/timetable", async function (req, res) {

    try { 
        result = await getAllEvents();
        res.render('timetable', result);
        console.log('', result);
    
        res.status(200).json();
        res.end;
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching events");
    }
});

//Page
async function getPage(pageSlug) {
    console.log(pageSlug);
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Pages/?filter[slug][_eq]="+pageSlug+"&fields[]=*.*.*");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        return data;
    }
}

app.get("/pages/:pageSlug/:language?", async function (req, res) {
    
    var pathname = req.originalUrl;

    try { 
        pageSlug = req.params.pageSlug;
        language = req.params.language  || 'de';

        console.log(language);
        result = await getPage(pageSlug);
        navigation = await getNavigation();
        footer = await getFooter();
        news = await getNews();

        result.data[0].pathname = langRemove(pathname);

        //console.log(result.data[0]);
        languageObject = [language,languageTransform(language)];
        if(result.data[0]){
            //console.log(languageObject);
            res.render('page',{data:result.data[0],navigation:navigation.data,footer:footer.data,language:languageObject,news:news.data});
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching page");
    }
});


//Event
async function getEvent(eventSlug) {
    console.log(eventSlug);
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Events/?filter[slug][_eq]="+eventSlug+"&fields[]=*.*.*");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        return data;
    }
}

app.get("/events/:eventSlug/:language?", async function (req, res) {

    var pathname = req.originalUrl;

    try { 
        eventSlug = req.params.eventSlug;
        language = req.params.language  || 'de';

        console.log(language);
        result = await getEvent(eventSlug);
        navigation = await getNavigation();
        footer = await getFooter();
        news = await getNews();
        //console.log(result.data[0]);

        result.data[0].pathname = langRemove(pathname);

        //Order of languages
        if(result.data[0].translations[0].languages_code.code == 'en'){
            let engData =  result.data[0].translations[0];
            let deData = result.data[0].translations[1];
            result.data[0].translations[0] = deData;
            result.data[0].translations[1] = engData;
        }
        console.log('Code: '+result.data[0].translations[0].languages_code.code);


        //Transformations
        //Price
        if(result.data[0].Price == 0){
            result.data[0].translations[0].Price = 'Eintritt gratis';
            result.data[0].translations[1].Price = 'Free entrance';
        }else if(result.data[0].Price == null){
            result.data[0].translations[0].Price = '';
            result.data[0].translations[1].Price = '';           
        }else{
            result.data[0].translations[0].Price = result.data[0].Price+' CHF';
            result.data[0].translations[1].Price = result.data[0].Price+' CHF';            
        }

        //Audience
        if(result.data[0].Audience == 'all'){
            result.data[0].translations[0].Audience = 'Geeignet für alle Gäste';
            result.data[0].translations[1].Audience = 'Suitable for all guests';
        }
        else if(result.data[0].Audience == 'kids'){
            result.data[0].translations[0].Audience = 'Geeignet für Kinder';
            result.data[0].translations[1].Audience = 'Suitable for kids';
        }
        else if(result.data[0].Audience == 'pros'){
            result.data[0].translations[0].Audience = 'Geeignet für Pros';
            result.data[0].translations[1].Audience = 'Suitable for pros';
        }
        else if(result.data[0].Audience == 'konferenz'){
                result.data[0].translations[0].Audience = 'Für Konferenzgäste';
                result.data[0].translations[1].Audience = 'For guests of the conference';
        }
        else{
            result.data[0].translations[0].Audience = '';
            result.data[0].translations[1].Audience = '';         
        }


        //Language
        if(result.data[0].Language == 'german'){
            result.data[0].translations[0].Language = 'In deutscher Sprache';
            result.data[0].translations[1].Language = 'In German';
        }
        else if(result.data[0].Language == 'english'){
            result.data[0].translations[0].Language = 'In englischer Sprache';
            result.data[0].translations[1].Language = 'In English';
        }
        else{
            result.data[0].translations[0].Language = '';
            result.data[0].translations[1].Language = '';         
        }

        //Seats
        if(result.data[0].Seats_available == 'yes'){
            result.data[0].translations[0].Seats_available = 'Plätze verfügbar';
            result.data[0].translations[1].Seats_available = 'Seats available';
        }
        else if(result.data[0].Seats_available == 'sold_out'){
            result.data[0].translations[0].Seats_available = 'Sorry, sold out!';
            result.data[0].translations[1].Seats_available = 'Sorry, sold out!';
        }else{
            result.data[0].translations[0].Seats_available = '';
            result.data[0].translations[1].Seats_available = '';            
        }

        //Time
        if(result.data[0].Time !== null){
            result.data[0].time_transformed = new Object;
            result.data[0].time_transformed.start = dateformat(result.data[0].Time[0].Start);
            result.data[0].time_transformed.end = dateformat(result.data[0].Time[0].End);
        }else{
            result.data[0].time_transformed = new Object;
            result.data[0].time_transformed.start = '';
            result.data[0].time_transformed.end = '';        
        }

        //Format
        var formatSlug = result.data[0].Format;
        const formatTranslation = {
            ausstellungen: 'Exhibitions',
            performances: 'Performances',
            screenings: 'Screenings',
            konferenz: 'Conference',
            workshops: 'Workshops',
            clubnights: 'Club Nights',
            diskurs: 'Discourse'
        };
        result.data[0].formatTranslation = [result.data[0].Format, formatTranslation[formatSlug]];

        //Time Frontend
        console.log(result.data[0].translations[0].Time_frontend );
        if(result.data[0].translations[0].Time_frontend !== null){
            result.data[0].translations[0].Time_frontend = result.data[0].translations[0].Time_frontend.replace('\n','<br>');
        }
        if(result.data[0].translations[1].Time_frontend !== null){
            result.data[0].translations[1].Time_frontend = result.data[0].translations[1].Time_frontend.replace('\n','<br>');
        }
 


        languageObject = [language,languageTransform(language)];
        if(result.data[0]){
            //console.log(languageObject);
            res.render('event',{data:result.data[0],navigation:navigation.data,footer:footer.data,language:languageObject,news:news.data});
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching page");
    }

});


//Startpage
async function getStartpage() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Startpage?fields[]=*.*.*.*");
    

    
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        return data;
    }
}

app.get("/:language?", async function (req, res) {
    
    var pathname = req.originalUrl;

    try { 
        language = req.params.language  || 'de';

        result = await getStartpage();
        navigation = await getNavigation();
        footer = await getFooter();
        news = await getNews();

        languageObject = [language,languageTransform(language)];

        //console.log(result);
        //console.log(language);
        result.data.pathname = langRemove(pathname);

        if(result){
             res.render('startpage',{data:result.data,navigation:navigation.data,footer:footer.data,news:news.data,language:languageObject});
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching page");
    }
});



function dateformat(dateIn){
    var dateUnix = Date.parse(dateIn);
    return new Date(dateUnix).toLocaleDateString('en-us', { weekday:"long", year:"numeric", month:"short", day:"numeric"});
}




//404
/* app.get('*', function(req, res){
    res.status(404).send('what???');
}); */


// robots.txt
app.get('/robots.txt', function (req, res) {
    res.type('text/plain');
    res.send("User-agent: *");
});





// Websocket
const io = require('socket.io')(server, {
    cors: {
        origin: "http://localhost:8100",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});

io.on('connection', function(socket) {
    var userId = socket.id;
    // console.log('joined: '+userId);
    socket.on('move', function(data){
        io.sockets.emit('moveTo', {id: userId,x:data.x, y:data.y});
    }); 
    socket.on('meeting', function(dataMeeting){
        console.log(dataMeeting)
        io.sockets.emit('meetingSend', {x: dataMeeting.x, y: dataMeeting.y } );
    }); 
    socket.on('disconnecting', function(socket){
        io.sockets.emit('left', userId);
    });
});