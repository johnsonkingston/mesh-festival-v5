const express = require("express");
const app = express();
const serverPort = 8080;

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

app.use(express.json({extended: true}));
var bodyParser = require('body-parser');

app.use(bodyParser.json());     
app.use(express.urlencoded());

//var force = require('express-force-domain');
//app.use( force('https://meshfestival.ch') );

app.use('/static', express.static('static'));
app.use('/static/lang', express.static('lang'));
app.use('/static/includes', express.static('includes'));
app.use('/node_modules', express.static('node_modules'));

app.use((req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    res.locals.baseURL = `${protocol}://${req.get('host')}/`;
    next();
});


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

let events;

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
        pathname = pathname.substring(1,pathname.length - 3);
    }else{
        pathname = pathname.substring(1,pathname.length);
    }
    if(pathname == '/'){
        pathname = '';
    }
    return pathname;
}

//Venues
async function getVenues() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Venues?fields[]=*.*");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
        const data = await response.json();
        //console.log(data.data);
        let dataArray = new Array();
        for (const [key, value] of Object.entries(data.data)) {
            //console.log(value);
            //console.log(value.id);
            dataArray[value.id] = {id:value.id,Name:value.Name};
        
        
        }
        //console.log('dataArray');
        data.data = dataArray;
        return data;
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

//Hightlights
async function getHighlights() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Highlights?fields[]=*.*");
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
// async function getNews() {
//     const response = await fetch("https://env-9468449.appengine.flow.ch/items/News?fields[]=*.*");
//     if (!response.ok) {
//         console.log('Response not okay');
//         const data = '';
//         return data;
//     }else
//     {
//         const data = await response.json();
//         return data;
//     }
// }

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
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
    const data = await response.json();

    events = data.data;
    let corrEvents;
    let eventsTemp = [];
    let eventsTemp2 = [];

    for (const [key, value] of Object.entries(events)) {
        if(value.Time == undefined){
            events[key].Time = [{}];
            events[key].Time[0].Start = '';
            events[key].Time[0].End = '';
            events[key].DateToOrder = 'zzz';
            events[key].Day = '';
            events[key].Hour = '';
            events[key].Minute = '';
            events[key].HourEnd = '';
        }else{
            if(value.Time.length > 1){
                corrEvents = [];
                for (let i = 0; i < value.Time.length; i++) {
                    var corrEvent = {};
                    corrEvent = structuredClone(events[key]);
                    corrEvent.Time[0] = structuredClone(corrEvent.Time[i]);
                    corrEvent = rewriteDate(corrEvent,0);
                    corrEvents.push(corrEvent);                   
                }

                for (let j = 0; j < corrEvents.length; j++) {
                    events.push(structuredClone(corrEvents[j]));
                }

            }else{
                events[key] = rewriteDate(events[key],0);
           }
        }
        console.log(events[key].Artist);
    }
    events.sort((a, b) => (a.DateToOrder || "").localeCompare(b.DateToOrder || ""));

    return data;
    }
}


function rewriteDate(event,subkey){
    console.log(event.Time[subkey].Start);
    if(event.Time[subkey].Start !== undefined){
        event.Day = event.Time[subkey].Start.split('-')[2].substring(0,2);
        event.Hour = event.Time[subkey].Start.split('-')[2].substring(3,5);
        event.Minute = event.Time[subkey].Start.split(':')[1];
    }

    
    if(event.Time[subkey].End !== undefined){
        event.HourEnd = parseInt(event.Time[subkey].End.split('-')[2].substring(3,5)) + (parseInt(event.Time[subkey].End.split(':')[1])/60);

        event.MinuteEnd = event.Time[subkey].End.split(':')[1];
    }else{
        event.HourEnd = '';
        event.MinuteEnd = '';
    }
    event.DateToOrder = event.Time[subkey].Start;

    return event;
}



app.get("/locations/:language?", async function (req, res) {
    var pathname = req.originalUrl;
    language = req.params.language || 'de';
    languageObject = [language, languageTransform(language)];

    try {
        result = await getAllEvents();
        navigation = await getNavigation();
        footer = await getFooter();
        venues = await getVenues();

        result.data[0].pathname = langRemove(pathname);

        if (result.data[0]) {
            res.render('locations', {data: result.data[0], events: events, navigation: navigation.data, footer: footer.data, language: languageObject, highlights: [], venues: venues.data, format: []});
        }
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

app.get("/timetable/:language?/:format?", async function (req, res) {
    var pathname = req.originalUrl;
    language = req.params.language  || 'de';
    languageObject = [language,languageTransform(language)];
    format = req.params.format  || 'none';

    try { 
        result = await getAllEvents();
        navigation = await getNavigation();
        footer = await getFooter();
        //news = await getNews();
        venues = await getVenues();

        language = req.params.language  || 'de';
        
        result.data[0].pathname = langRemove(pathname);




        if(result.data[0]){
            res.render('timetable', {data:result.data[0],events:events,navigation:navigation.data,footer:footer.data,language:languageObject,highlights:[],venues:venues.data,format:format});
        }
        
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});






//Artists
async function getAllArtists() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*.*&limit=1000");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
    const data = await response.json();

    events = data.data;
    let artists = [];

    for (const [key, value] of Object.entries(events)) {

        if(events[key].Artists_in_List !== null && events[key].status == 'published'){
            var artist = [];
            for (const [keyArtist, valueArtist] of Object.entries(events[key].Artists_in_List)) {
                if(valueArtist.First_name == undefined){
                    artist.First_Name = '';
                }else{
                    artist.First_Name = valueArtist.First_name;
                }
                
                artist.Name = valueArtist.Name;
                artist.Format = value.Format;
                artist.slug = value.slug;
                artist.Title = value.translations && value.translations[0] ? value.translations[0].Title : '';
                artist.Venues = value.Venues;
                artists.push(structuredClone(artist));
            }
        }   
    }

    artists.sort((a, b) => (a.Name).localeCompare(b.Name));

    events = artists;

    return data;
    }
}




app.get("/artists/:language?/", async function (req, res) {
    var pathname = req.originalUrl;
    language = req.params.language  || 'de';
    languageObject = [language,languageTransform(language)];

    try { 
        result = await getAllArtists();
        navigation = await getNavigation();
        footer = await getFooter();
        // = await getNews();
        venues = await getVenues();

        language = req.params.language  || 'de';
        
        result.data[0].pathname = langRemove(pathname);


        if(result.data[0]){
            res.render('artists', {data:result.data[0],events:events,navigation:navigation.data,footer:footer.data,language:languageObject,highlights:[],venues:venues.data,format:[]});
        }
        
    } catch (err) {
        console.error(err);
    }
});







//List
async function getAllEventsList() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000");
    if (!response.ok) {
        console.log('Response not okay');
        const data = '';
        return data;
    }else
    {
    const data = await response.json();

    events = data.data;
    let corrEvents;
    let eventsTemp = [];
    let eventsTemp2 = [];

    for (const [key, value] of Object.entries(events)) {
        if(value.Time == undefined){
            events[key].Time = [{}];
            events[key].Time[0].Start = '';
            events[key].Time[0].End = '';
            events[key].DateToOrder = 'zzz';
            events[key].Day = '';
            events[key].Hour = '';
            events[key].Minute = '';
            events[key].HourEnd = '';
        }else{
            if(value.Time.length > 1){
                corrEvents = [];
                for (let i = 0; i < value.Time.length; i++) {
                    var corrEvent = {};
                    corrEvent = structuredClone(events[key]);
                    corrEvent.Time[0] = structuredClone(corrEvent.Time[i]);
                    corrEvent = rewriteDate(corrEvent,0);
                    corrEvents.push(corrEvent);                   
                }

                for (let j = 0; j < corrEvents.length; j++) {
                    events.push(structuredClone(corrEvents[j]));
                }

            }else{
                events[key] = rewriteDate(events[key],0);
           }
        }
        console.log(events[key].Artist);
    }
    events.sort((a, b) => (a.DateToOrder || "").localeCompare(b.DateToOrder || ""));

    return data;
    }
}



app.get("/list/:language?/:format?", async function (req, res) {
    var pathname = req.originalUrl;
    language = req.params.language  || 'de';
    languageObject = [language,languageTransform(language)];
    format = req.params.format  || 'none';

    try { 
        result = await getAllEvents();
        navigation = await getNavigation();
        footer = await getFooter();
        //news = await getNews();
        venues = await getVenues();

        language = req.params.language  || 'de';
        
        result.data[0].pathname = langRemove(pathname);


        if(result.data[0]){
            res.render('list', {data:result.data[0],events:events,navigation:navigation.data,footer:footer.data,language:languageObject,highlights:[],venues:venues.data,format:format});
        }
        
    } catch (err) {
        console.error(err);
        res.redirect('/');
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

        result.data[0].pathname = langRemove(pathname);

        if(result.data[0].translations[0].languages_code.code !== 'de'){
            var deContent = result.data[0].translations[1];
            result.data[0].translations[1] = result.data[0].translations[0];
            result.data[0].translations[0] = deContent;
        }

        languageObject = [language,languageTransform(language)];
        if(result.data[0]){
            //console.log(languageObject);
            res.render('page',{data:result.data[0],navigation:navigation.data,footer:footer.data,language:languageObject,highlights:[],events:[],venues:[],format:[]});
        }


    } catch (err) {
        console.error(err);
        res.redirect('/');
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
        //news = await getNews();
        //console.log(result.data[0]);

        result.data[0].pathname = langRemove(pathname);

        //Order of languages
        if(result.data[0].translations[0].languages_code.code == 'en'){
            let engData =  result.data[0].translations[0];
            let deData = result.data[0].translations[1];
            result.data[0].translations[0] = deData;
            result.data[0].translations[1] = engData;
        }
        //console.log('Code: '+result.data[0].translations[0].languages_code.code);


        //Transformations
        //Price
        if(result.data[0].Price == 0){
            result.data[0].translations[0].Price = 'Eintritt gratis';
            result.data[0].translations[1].Price = 'Free entrance';
        }else if(result.data[0].Price == null){
            result.data[0].translations[0].Price = '';
            result.data[0].translations[1].Price = '';           
        }else{
            result.data[0].translations[0].Price = result.data[0].Price;
            result.data[0].translations[1].Price = result.data[0].Price;            
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
            if(result.data[0].Time[0].End !== undefined){
                result.data[0].time_transformed.end = dateformat(result.data[0].Time[0].End);
            }else{
                result.data[0].time_transformed.end = result.data[0].time_transformed.start;
            }
            result.data[0].time_transformed_de = new Object;
            result.data[0].time_transformed_de.start = dateformat_de(result.data[0].Time[0].Start);
            if(result.data[0].Time[0].End !== undefined){
                result.data[0].time_transformed_de.end = dateformat_de(result.data[0].Time[0].End);
            }else{
                result.data[0].time_transformed_de.end = result.data[0].time_transformed.start;
            }

        }else{
            result.data[0].time_transformed = new Object;
            result.data[0].time_transformed.start = '';
            result.data[0].time_transformed.end = '';        
        }

        //Format
        var formatSlug = result.data[0].Format;
        const formatTranslationDE = {
            ausstellungen: 'Ausstellung',
            performances: 'Performance',
            screenings: 'Screening',
            konferenz: 'Konferenz',
            workshops: 'Workshops',
            clubnights: 'Club Nights',
            diskurs: 'Talks & Panels'
        };
        const formatTranslationEN = {
            ausstellungen: 'Exhibitions',
            performances: 'Performances',
            screenings: 'Screenings',
            konferenz: 'Conference',
            workshops: 'Workshops',
            clubnights: 'Club Nights',
            diskurs: 'Talks & Panels'
        };
        result.data[0].formatTranslation = [formatTranslationDE[formatSlug], formatTranslationEN[formatSlug]];

        //Time Frontend
       // console.log(result.data[0].translations[0].Time_frontend );
        if(result.data[0].translations[0].Time_frontend !== null){
            result.data[0].translations[0].Time_frontend = result.data[0].translations[0].Time_frontend.replace('\n','<br>');
        }
        if(result.data[0].translations[1].Time_frontend !== null){
            result.data[0].translations[1].Time_frontend = result.data[0].translations[1].Time_frontend.replace('\n','<br>');
        }
 


        languageObject = [language,languageTransform(language)];
        if(result.data[0]){
            //console.log(languageObject);
            res.render('event',{data:result.data[0],navigation:navigation.data,footer:footer.data,language:languageObject,highlights:[],events:[],venues:[],format:[]});
        }

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }

});

// robots.txt
app.get("/robots.txt", async function (req, res) {
    res.type('text/plain');
    res.send("User-agent: *");
});


//Startpage
async function getStartpage() {
    const response = await fetch("https://env-9468449.appengine.flow.ch/items/Pages/?filter[slug][_eq]=startpage&fields[]=*.*.*");
        
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

       //if(result.length<1){
        //console.log(req);
        //}    
        var pathname = req.originalUrl;


    try { 
        language = req.params.language  || 'de';

        result = await getStartpage();
        navigation = await getNavigation();
        footer = await getFooter();
        highlights = await getHighlights();

        languageObject = [language,languageTransform(language)];

        //console.log(result);
        //console.log(language);
        result.data[0].pathname = langRemove(pathname);

        if(result.data[0].translations && result.data[0].translations.length > 0){
            if(result.data[0].translations[0].languages_code.code !== 'de'){
                var deContent = result.data[0].translations[1];
                result.data[0].translations[1] = result.data[0].translations[0];
                result.data[0].translations[0] = deContent;
            }
        }

        if(result){
             res.render('startpage',{data:result.data[0],navigation:navigation.data,footer:footer.data,highlights:highlights.data,language:languageObject,events:[],venues:[],format:[]});
        }

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});



function dateformat(dateIn){
    var dateUnix = Date.parse(dateIn);
    var time = dateIn.split('-')[2].substring(3,5)+':'+dateIn.split(':')[1];

    return new Date(dateUnix).toLocaleDateString('en-us', { weekday:"long", year:"numeric", month:"short", day:"numeric"})+' / '+time;
}
function dateformat_de(dateIn){
    var dateUnix = Date.parse(dateIn);
    var time = dateIn.split('-')[2].substring(3,5)+':'+dateIn.split(':')[1];

    return new Date(dateUnix).toLocaleDateString('de-DE', { weekday:"long", year:"numeric", month:"short", day:"numeric"})+' / '+time;
}



//404
app.all('*', (req, res) => {
    res.redirect('/');
})







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