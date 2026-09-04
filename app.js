//version 5.0.0
const express = require("express");
const app = express();
const serverPort = process.env.PORT || 8080;

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.use(express.json({ extended: true }));
var bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(express.urlencoded());

//var force = require('express-force-domain');
//app.use( force('https://meshfestival.ch') );

app.use("/static", express.static("static"));
app.use("/static/lang", express.static("lang"));
app.use("/static/includes", express.static("includes"));
app.use("/node_modules", express.static("node_modules"));

app.use((req, res, next) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  res.locals.baseURL = `${protocol}://${req.get("host")}/`;
  next();
});

const fs = require("fs");
var path = require("path");
var glob = require("glob");

app.engine("pug", require("pug").__express);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

//Start Server
const server = app.listen(serverPort, () => {
  console.log("App running on port " + serverPort);
});

let events;

// --- simple in-memory cache with short TTL --------------------------------
// Collapses the per-request CMS fan-out: identical upstream calls within the
// TTL window are served from memory instead of re-fetching Directus.
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 30 * 1000;
const _cache = new Map(); // key -> { expires:Number, value:any }

function cacheSet(key, value) {
  // keep the map from growing unbounded (e.g. slug-fuzzing bots)
  if (_cache.size > 250) {
    const now = Date.now();
    for (const [k, v] of _cache) if (v.expires <= now) _cache.delete(k);
    if (_cache.size > 250) _cache.clear();
  }
  _cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

// For getters with no side effects: memoise their return value.
// Failed/empty responses are not cached, so recovery is immediate.
// Pass clone=true for results that route handlers mutate in place (page/event),
// so the cached copy is never touched.
async function cached(key, producer, clone) {
  const hit = _cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return clone ? structuredClone(hit.value) : hit.value;
  }
  const value = await producer();
  if (value !== "" && value != null) cacheSet(key, value);
  return clone && value !== "" && value != null ? structuredClone(value) : value;
}

// For the Events getters, which also populate the module-level `events`:
// cache both the return value and the resulting `events` array, and restore
// the global on a cache hit.
async function cachedEvents(key, producer) {
  const hit = _cache.get(key);
  if (hit && hit.expires > Date.now()) {
    events = hit.value.events;
    return hit.value.data;
  }
  const data = await producer(); // sets the global `events` as a side effect
  if (data !== "" && data != null) cacheSet(key, { data, events });
  return data;
}

//Language
function languageTransform(string) {
  if (string == "en") {
    return 1;
  } else {
    return 0;
  }
}
function langRemove(pathname) {
  var queryIndex = pathname.indexOf("?");
  if (queryIndex !== -1) {
    pathname = pathname.substring(0, queryIndex);
  }
  if (
    pathname.substr(pathname.length - 3) == "/en" ||
    pathname.substr(pathname.length - 3) == "/de"
  ) {
    pathname = pathname.substring(1, pathname.length - 3);
  } else {
    pathname = pathname.substring(1, pathname.length);
  }
  if (pathname == "/") {
    pathname = "";
  }
  return pathname;
}

//Venues
async function getVenues() {
  return cached("venues", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Venues?fields[]=*.*",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    const data = await response.json();
    let dataArray = new Array();
    for (const [key, value] of Object.entries(data.data)) {
      dataArray[value.id] = { id: value.id, Name: value.Name };
    }
    data.data = dataArray;
    return data;
  });
}

async function getVenuesOverview() {
  return cached("venuesOverview", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Venues/?filter[In_Overview][_eq]=true&fields[]=*.*",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//Navigation
async function getNavigation() {
  return cached("navigation", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Navigation_translations",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//Hightlights
async function getHighlights() {
  return cached("highlights", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Highlights?fields[]=*.*",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
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
  return cached("footer", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Footer_translations",
    );
    if (!response.ok) {
      console.log("Response not okay");
      return "";
    }
    return await response.json();
  });
}

//Timetable
async function getAllEvents() {
  return cachedEvents("allEvents", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000",
    );
    if (!response.ok) {
      console.log("Response not okay");
      events = [];
      return "";
    }
    const data = await response.json();

    events = data.data;
    let corrEvents;

    for (const [key, value] of Object.entries(events)) {
      if (value.Time == undefined) {
        events[key].Time = [{}];
        events[key].Time[0].Start = "";
        events[key].Time[0].End = "";
        events[key].DateToOrder = "zzz";
        events[key].Day = "";
        events[key].Hour = "";
        events[key].Minute = "";
        events[key].HourEnd = "";
      } else {
        if (value.Time.length > 1) {
          corrEvents = [];
          for (let i = 0; i < value.Time.length; i++) {
            var corrEvent = {};
            corrEvent = structuredClone(events[key]);
            corrEvent.Time[0] = structuredClone(corrEvent.Time[i]);
            corrEvent = rewriteDate(corrEvent, 0);
            corrEvents.push(corrEvent);
          }

          for (let j = 0; j < corrEvents.length; j++) {
            events.push(structuredClone(corrEvents[j]));
          }
        } else {
          events[key] = rewriteDate(events[key], 0);
        }
      }
    }
    events.sort((a, b) =>
      (a.DateToOrder || "").localeCompare(b.DateToOrder || ""),
    );

    return data;
  });
}

function rewriteDate(event, subkey) {
  if (event.Time[subkey].Start !== undefined) {
    event.Day = event.Time[subkey].Start.split("-")[2].substring(0, 2);
    event.Hour = event.Time[subkey].Start.split("-")[2].substring(3, 5);
    event.Minute = event.Time[subkey].Start.split(":")[1];
  }

  if (event.Time[subkey].End !== undefined) {
    var endDay = event.Time[subkey].End.split("-")[2].substring(0, 2);
    var dayOffset = endDay !== event.Day ? 24 : 0;
    event.HourEnd =
      dayOffset +
      parseInt(event.Time[subkey].End.split("-")[2].substring(3, 5)) +
      parseInt(event.Time[subkey].End.split(":")[1]) / 60;

    event.MinuteEnd = event.Time[subkey].End.split(":")[1];
  } else {
    event.HourEnd = "";
    event.MinuteEnd = "";
  }
  event.DateToOrder = event.Time[subkey].Start;

  return event;
}

async function renderTimetable(req, res, extraLocals) {
  extraLocals = extraLocals || {};
  var pathname = req.originalUrl;
  language = req.params.language || "de";
  languageObject = [language, languageTransform(language)];
  format = extraLocals.format || req.params.format || "none";

  result = await getAllEvents();
  navigation = await getNavigation();
  footer = await getFooter();
  //news = await getNews();
  venues = await getVenues();

  result.data[0].pathname = langRemove(pathname);

  if (result.data[0]) {
    res.render("timetable", {
      data: result.data[0],
      events: events,
      navigation: navigation.data,
      footer: footer.data,
      language: languageObject,
      highlights: [],
      venues: venues.data,
      format: format,
      slides: [],
      autoOpenEvent: extraLocals.autoOpenEvent || null,
    });
  }
}

app.get("/timetable/:language?/:format?", async function (req, res) {
  try {
    await renderTimetable(req, res);
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Artists
async function getAllArtists() {
  return cachedEvents("allArtists", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*.*&limit=1000",
    );
    if (!response.ok) {
      console.log("Response not okay");
      events = [];
      return "";
    }
    const data = await response.json();

    events = data.data;
    let artists = [];

    for (const [key, value] of Object.entries(events)) {
      if (
        events[key].Artists_in_List !== null &&
        events[key].status == "published"
      ) {
        var artist = [];
        for (const [keyArtist, valueArtist] of Object.entries(
          events[key].Artists_in_List,
        )) {
          if (valueArtist.First_name == undefined) {
            artist.First_Name = "";
          } else {
            artist.First_Name = valueArtist.First_name;
          }

          artist.Name = valueArtist.Name;
          artist.Format = value.Format;
          artist.Thema = value.Thema;
          artist.slug = value.slug;
          artist.Title =
            value.translations && value.translations[0]
              ? value.translations[0].Title
              : "";
          artist.Venues = value.Venues;
          artists.push(structuredClone(artist));
        }
      }
    }

    // neutral base order (by name); the /artists route re-sorts per view
    artists.sort((a, b) => (a.Name || "").localeCompare(b.Name || ""));

    events = artists;

    return data;
  });
}

// artist list view orderings: "formate" (by format), "themen" (by topic), "az" (name only)
const ARTIST_FORMAT_ORDER = [
  "ausstellungen",
  "screenings",
  "diskurs",
  "konferenz",
  "performances",
  "clubnights",
  "workshops",
];
function sortArtists(list, sort) {
  var out = (list || []).slice();
  if (sort === "themen") {
    out.sort((a, b) => {
      var at = (a.Thema || "").trim();
      var bt = (b.Thema || "").trim();
      var ae = at === "" ? 1 : 0;
      var be = bt === "" ? 1 : 0;
      if (ae !== be) return ae - be; // entries without a topic go last
      if (at !== bt) return at.localeCompare(bt);
      return (a.Name || "").localeCompare(b.Name || "");
    });
  } else if (sort === "az") {
    out.sort(
      (a, b) =>
        (a.Name || "").localeCompare(b.Name || "") ||
        (a.First_Name || "").localeCompare(b.First_Name || ""),
    );
  } else {
    out.sort((a, b) => {
      var ai = ARTIST_FORMAT_ORDER.indexOf(a.Format);
      var bi = ARTIST_FORMAT_ORDER.indexOf(b.Format);
      if (ai === -1) ai = ARTIST_FORMAT_ORDER.length;
      if (bi === -1) bi = ARTIST_FORMAT_ORDER.length;
      if (ai !== bi) return ai - bi;
      return (a.Name || "").localeCompare(b.Name || "");
    });
  }
  return out;
}

app.get("/artists/:language?/", async function (req, res) {
  var pathname = req.originalUrl;
  language = req.params.language || "de";
  languageObject = [language, languageTransform(language)];

  var sort = req.query.sort;
  if (sort !== "themen" && sort !== "az") sort = "formate";

  try {
    result = await getAllArtists();
    navigation = await getNavigation();
    footer = await getFooter();
    venues = await getVenues();

    language = req.params.language || "de";

    result.data[0].pathname = langRemove(pathname);

    if (result.data[0]) {
      res.render("artists", {
        data: result.data[0],
        events: sortArtists(events, sort),
        sort: sort,
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        venues: venues.data,
        format: [],
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
  }
});

// the exhibitions page is gone – it is now the "Themen" view of /artists
app.get(["/ausstellungen", "/ausstellungen/:language?"], function (req, res) {
  var lang = req.params.language === "en" ? "/en" : "";
  res.redirect("/artists" + lang + "?sort=themen");
});

//List
async function getAllEventsList() {
  return cachedEvents("allEventsList", async () => {
    const response = await fetch(
      "https://env-9468449.appengine.flow.ch/items/Events?fields[]=*.*&limit=1000",
    );
    if (!response.ok) {
      console.log("Response not okay");
      events = [];
      return "";
    }
    const data = await response.json();

    events = data.data;
    let corrEvents;

    for (const [key, value] of Object.entries(events)) {
      if (value.Time == undefined) {
        events[key].Time = [{}];
        events[key].Time[0].Start = "";
        events[key].Time[0].End = "";
        events[key].DateToOrder = "zzz";
        events[key].Day = "";
        events[key].Hour = "";
        events[key].Minute = "";
        events[key].HourEnd = "";
      } else {
        if (value.Time.length > 1) {
          corrEvents = [];
          for (let i = 0; i < value.Time.length; i++) {
            var corrEvent = {};
            corrEvent = structuredClone(events[key]);
            corrEvent.Time[0] = structuredClone(corrEvent.Time[i]);
            corrEvent = rewriteDate(corrEvent, 0);
            corrEvents.push(corrEvent);
          }

          for (let j = 0; j < corrEvents.length; j++) {
            events.push(structuredClone(corrEvents[j]));
          }
        } else {
          events[key] = rewriteDate(events[key], 0);
        }
      }
    }
    events.sort((a, b) =>
      (a.DateToOrder || "").localeCompare(b.DateToOrder || ""),
    );

    return data;
  });
}

app.get("/list/:language?/:format?", async function (req, res) {
  var pathname = req.originalUrl;
  language = req.params.language || "de";
  languageObject = [language, languageTransform(language)];
  format = req.params.format || "none";

  try {
    result = await getAllEvents();
    navigation = await getNavigation();
    footer = await getFooter();
    //news = await getNews();
    venues = await getVenues();

    language = req.params.language || "de";

    result.data[0].pathname = langRemove(pathname);

    if (result.data[0]) {
      res.render("list", {
        data: result.data[0],
        events: events,
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        venues: venues.data,
        format: format,
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Page
async function getPage(pageSlug) {
  console.log(pageSlug);
  return cached(
    "page:" + pageSlug,
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Pages/?filter[slug][_eq]=" +
          pageSlug +
          "&fields[]=*.*.*",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    true, // route handler mutates result in place
  );
}

app.get("/pages/:pageSlug/:language?", async function (req, res) {
  var pathname = req.originalUrl;
  try {
    pageSlug = req.params.pageSlug;
    language = req.params.language || "de";

    console.log(language);
    result = await getPage(pageSlug);

    navigation = await getNavigation();
    footer = await getFooter();

    result.data[0].pathname = langRemove(pathname);

    if (result.data[0].translations[0].languages_code.code !== "de") {
      var deContent = result.data[0].translations[1];
      result.data[0].translations[1] = result.data[0].translations[0];
      result.data[0].translations[0] = deContent;
    }

    languageObject = [language, languageTransform(language)];
    if (result.data[0]) {
      //console.log(languageObject);
      var template =
        pageSlug === "visit"
          ? "visit"
          : pageSlug === "locations"
            ? "locations"
            : "page";
      var venuesOverview = [];
      if (pageSlug === "locations") {
        var venuesOverviewResult = await getVenuesOverview();
        venuesOverview = venuesOverviewResult.data || [];
      }
      res.render(template, {
        data: result.data[0],
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        events: [],
        venues: venuesOverview,
        format: [],
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Event
async function getEvent(eventSlug) {
  console.log(eventSlug);
  return cached(
    "event:" + eventSlug,
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Events/?filter[slug][_eq]=" +
          eventSlug +
          "&fields[]=*.*.*",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    true, // route handler mutates result in place
  );
}

app.get("/events/:eventSlug/:language?", async function (req, res) {
  var pathname = req.originalUrl;

  try {
    eventSlug = req.params.eventSlug;
    language = req.params.language || "de";

    if (!req.query.embed) {
      await renderTimetable(req, res, { autoOpenEvent: eventSlug });
      return;
    }

    console.log(language);
    result = await getEvent(eventSlug);
    navigation = await getNavigation();
    footer = await getFooter();
    //news = await getNews();
    //console.log(result.data[0]);

    result.data[0].pathname = langRemove(pathname);

    //Order of languages
    if (result.data[0].translations[0].languages_code.code == "en") {
      let engData = result.data[0].translations[0];
      let deData = result.data[0].translations[1];
      result.data[0].translations[0] = deData;
      result.data[0].translations[1] = engData;
    }
    //console.log('Code: '+result.data[0].translations[0].languages_code.code);

    //Fallback if only one translation exists in the CMS
    if (!result.data[0].translations[1]) {
      result.data[0].translations[1] = JSON.parse(
        JSON.stringify(result.data[0].translations[0]),
      );
    }
    if (!result.data[0].translations[0]) {
      result.data[0].translations[0] = JSON.parse(
        JSON.stringify(result.data[0].translations[1]),
      );
    }

    //Transformations
    //Price
    if (result.data[0].Price == 0) {
      result.data[0].translations[0].Price = "Eintritt gratis";
      result.data[0].translations[1].Price = "Free entrance";
    } else if (result.data[0].Price == null) {
      result.data[0].translations[0].Price = "";
      result.data[0].translations[1].Price = "";
    } else {
      result.data[0].translations[0].Price = result.data[0].Price;
      result.data[0].translations[1].Price = result.data[0].Price;
    }

    //Audience
    if (result.data[0].Audience == "all") {
      result.data[0].translations[0].Audience = "Geeignet für alle Gäste";
      result.data[0].translations[1].Audience = "Suitable for all guests";
    } else if (result.data[0].Audience == "kids") {
      result.data[0].translations[0].Audience = "Geeignet für Kinder";
      result.data[0].translations[1].Audience = "Suitable for kids";
    } else if (result.data[0].Audience == "pros") {
      result.data[0].translations[0].Audience = "Geeignet für Pros";
      result.data[0].translations[1].Audience = "Suitable for pros";
    } else if (result.data[0].Audience == "konferenz") {
      result.data[0].translations[0].Audience = "Für Konferenzgäste";
      result.data[0].translations[1].Audience = "For guests of the conference";
    } else {
      result.data[0].translations[0].Audience = "";
      result.data[0].translations[1].Audience = "";
    }

    //Language
    if (result.data[0].Language == "german") {
      result.data[0].translations[0].Language = "In deutscher Sprache";
      result.data[0].translations[1].Language = "In German";
    } else if (result.data[0].Language == "english") {
      result.data[0].translations[0].Language = "In englischer Sprache";
      result.data[0].translations[1].Language = "In English";
    } else {
      result.data[0].translations[0].Language = "";
      result.data[0].translations[1].Language = "";
    }

    //Seats
    if (result.data[0].Seats_available == "yes") {
      result.data[0].translations[0].Seats_available = "Plätze verfügbar";
      result.data[0].translations[1].Seats_available = "Seats available";
    } else if (result.data[0].Seats_available == "sold_out") {
      result.data[0].translations[0].Seats_available = "Sorry, sold out!";
      result.data[0].translations[1].Seats_available = "Sorry, sold out!";
    } else {
      result.data[0].translations[0].Seats_available = "";
      result.data[0].translations[1].Seats_available = "";
    }

    //Time
    if (result.data[0].Time !== null) {
      result.data[0].time_transformed = new Object();
      result.data[0].time_transformed.start = dateformat(
        result.data[0].Time[0].Start,
      );
      if (result.data[0].Time[0].End !== undefined) {
        result.data[0].time_transformed.end = dateformat(
          result.data[0].Time[0].End,
        );
      } else {
        result.data[0].time_transformed.end =
          result.data[0].time_transformed.start;
      }
      result.data[0].time_transformed_de = new Object();
      result.data[0].time_transformed_de.start = dateformat_de(
        result.data[0].Time[0].Start,
      );
      if (result.data[0].Time[0].End !== undefined) {
        result.data[0].time_transformed_de.end = dateformat_de(
          result.data[0].Time[0].End,
        );
      } else {
        result.data[0].time_transformed_de.end =
          result.data[0].time_transformed.start;
      }
    } else {
      result.data[0].time_transformed = new Object();
      result.data[0].time_transformed.start = "";
      result.data[0].time_transformed.end = "";
    }

    //Format
    var formatSlug = result.data[0].Format;
    const formatTranslationDE = {
      ausstellungen: "Ausstellung",
      performances: "Performance",
      screenings: "Screening",
      konferenz: "Konferenz",
      workshops: "Workshops",
      clubnights: "Club Nights",
      diskurs: "Talks & Panels",
    };
    const formatTranslationEN = {
      ausstellungen: "Exhibitions",
      performances: "Performances",
      screenings: "Screenings",
      konferenz: "Conference",
      workshops: "Workshops",
      clubnights: "Club Nights",
      diskurs: "Talks & Panels",
    };
    result.data[0].formatTranslation = [
      formatTranslationDE[formatSlug],
      formatTranslationEN[formatSlug],
    ];

    //Time Frontend
    // console.log(result.data[0].translations[0].Time_frontend );
    if (result.data[0].translations[0].Time_frontend !== null) {
      result.data[0].translations[0].Time_frontend =
        result.data[0].translations[0].Time_frontend.replace("\n", "<br>");
    }
    if (result.data[0].translations[1].Time_frontend !== null) {
      result.data[0].translations[1].Time_frontend =
        result.data[0].translations[1].Time_frontend.replace("\n", "<br>");
    }

    languageObject = [language, languageTransform(language)];
    if (result.data[0]) {
      //console.log(languageObject);
      res.render("event", {
        data: result.data[0],
        navigation: navigation.data,
        footer: footer.data,
        language: languageObject,
        highlights: [],
        events: [],
        venues: [],
        format: [],
        slides: [],
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

// robots.txt
app.get("/robots.txt", async function (req, res) {
  res.type("text/plain");
  res.send("User-agent: *");
});

// Title-slide generator tool for conference speakers
app.get("/generate-slides", function (req, res) {
  res.render("generate-slides");
});

// Quick A4 print tool for small posters / notes
app.get("/print", function (req, res) {
  res.render("print");
});

// Per-day program poster (9:16), exportable as JPG
app.get("/screens/:language?", async function (req, res) {
  try {
    const language = req.params.language || "de";
    const langIdx = languageTransform(language);

    await getAllEvents(); // populates the module-level `events` (cached)
    const venuesResult = await getVenues();
    const venuesData = (venuesResult && venuesResult.data) || [];

    const screenEvents = (events || [])
      .filter(
        (e) =>
          e &&
          e.status === "published" &&
          e.In_Timetable &&
          e.Timetable_only !== "1" &&
          e.Venues &&
          e.Venues[0] &&
          e.Day &&
          e.Hour !== "" &&
          e.Hour != null,
      )
      .map((e) => {
        const tr =
          (e.translations && (e.translations[langIdx] || e.translations[0])) ||
          {};
        const v = venuesData[e.Venues[0].Venues_id];
        return {
          day: String(e.Day),
          format: e.Format || "",
          subformat: e.Subformat || "",
          title: tr.Title || "",
          artist: e.Artist || "",
          hourStart: parseInt(e.Hour, 10) || 0,
          minStart: e.Minute ? parseInt(e.Minute, 10) : 0,
          hourEnd:
            e.HourEnd === "" || e.HourEnd == null ? null : Number(e.HourEnd),
          minEnd: e.MinuteEnd ? parseInt(e.MinuteEnd, 10) : 0,
          venue: v ? v.Name : "",
        };
      });

    res.render("screens", {
      screenEvents,
      language: [language, langIdx],
    });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

//Startpage
async function getStartpage() {
  return cached(
    "startpage",
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Startpage?fields[]=*.*.*",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    true, // route handler mutates result in place
  );
}

//Startpage Slider
async function getSlides() {
  return cached(
    "slides",
    async () => {
      const response = await fetch(
        "https://env-9468449.appengine.flow.ch/items/Slides_Startpage?fields[]=*.*&fields[]=Link.item:Events.slug",
      );
      if (!response.ok) {
        console.log("Response not okay");
        return "";
      }
      return await response.json();
    },
    true, // route handler mutates slide objects in place
  );
}

app.get("/:language?", async function (req, res) {
  var pathname = req.originalUrl;

  try {
    language = req.params.language || "de";

    result = await getStartpage();
    navigation = await getNavigation();
    footer = await getFooter();
    highlights = await getHighlights();
    slidesResult = await getSlides();

    languageObject = [language, languageTransform(language)];

    //console.log(result);
    //console.log(language);
    result.data.pathname = langRemove(pathname);
    result.data.translations = result.data.title;

    if (result.data.translations && result.data.translations.length > 0) {
      if (result.data.translations[0].languages_code.code !== "de") {
        var deContent = result.data.translations[1];
        result.data.translations[1] = result.data.translations[0];
        result.data.translations[0] = deContent;
      }
    }

    var translation = result.data.translations
      ? result.data.translations[languageObject[1]]
      : null;

    var slideLangCode = function (translation) {
      if (!translation) return null;
      return translation.languages_code && translation.languages_code.code
        ? translation.languages_code.code
        : translation.languages_code;
    };

    var slides = ((slidesResult && slidesResult.data) || [])
      .filter((slide) => slide.status === "published" && slide.File)
      .map((slide) => {
        if (slide.translations && slide.translations.length > 1) {
          if (slideLangCode(slide.translations[0]) !== "de") {
            var deSlide = slide.translations[1];
            slide.translations[1] = slide.translations[0];
            slide.translations[0] = deSlide;
          }
        }
        var eventLink =
          slide.Link &&
          slide.Link[0] &&
          slide.Link[0].collection === "Events" &&
          slide.Link[0].item &&
          slide.Link[0].item.slug
            ? slide.Link[0].item.slug
            : null;
        slide.eventSlug = eventLink;
        return slide;
      })
      .sort((a, b) => {
        var sortA = a.sort === null || a.sort === undefined ? 0 : a.sort;
        var sortB = b.sort === null || b.sort === undefined ? 0 : b.sort;
        return sortA - sortB;
      });

    var mapLogos = (entries) =>
      (entries || [])
        .map((entry) => entry.directus_files_id)
        .filter((file) => file)
        .map((file) => ({
          src: "https://env-9468449.appengine.flow.ch/assets/" + file.id,
          href: file.description || null,
          title: file.title || file.filename_download || "",
          tags: file.tags || [],
        }));

    if (result) {
      res.render("startpage", {
        data: result.data,
        navigation: navigation.data,
        footer: footer.data,
        highlights: highlights.data,
        language: languageObject,
        events: [],
        venues: [],
        slides: slides,
        format: [],
        initiative: translation ? translation.Logos_Line_1_Title : null,
        sponsor: translation ? translation.Logos_Line_2_Title : null,
        logosLine1: mapLogos(result.data.Logos_Line_1),
        logosLine2: mapLogos(result.data.Logos_Line_2),
        logosLine3: result.data.Logos_Line_3 || null,
        logosLine3Title: translation ? translation.Logos_Line_3_Title : null,
        newsContent:
          result.data.Show_News && translation ? translation.News : null,
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

function dateformat(dateIn) {
  var dateUnix = Date.parse(dateIn);
  var time = dateIn.split("-")[2].substring(3, 5) + ":" + dateIn.split(":")[1];

  return (
    new Date(dateUnix).toLocaleDateString("en-us", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " / " +
    time
  );
}
function dateformat_de(dateIn) {
  var dateUnix = Date.parse(dateIn);
  var time = dateIn.split("-")[2].substring(3, 5) + ":" + dateIn.split(":")[1];

  return (
    new Date(dateUnix).toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " / " +
    time
  );
}

//404
app.all("*", (req, res) => {
  res.redirect("/");
});
