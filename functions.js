const fs = require("fs");
const csv = require("csvtojson");
const vega = require("vega");
const vl = require("vega-lite");
const J2CP = require("json2csv").Parser;
const converter = csv({
  alwaysSplitAtEOL : true
});



// Conversion des fichiers csv en objet
var csvToJson = async (files) => {
    let jsonObj = [], nextObj;

    for(let i = 0; i < files.length; i++){
        nextObj =  await csv().fromFile(files[i]).then(result => { return result });
        jsonObj = jsonObj.concat(nextObj);
    }

    return jsonObj;
}

//Suppression des retweets
var suppressionRetweets = (jsonObj) => {
    for (let i = 0; i < jsonObj.length; i++) {
        jsonObj.splice(i, 1);
    }
    return jsonObj;
}

// Nombre de tweets sur un hashtag pour une période donnée par journée (Tranche horaire d’heure en heure).
var nbTweetsParJournée = (jsonObj, day, hour_min, hour_max, hashtag) => {

    hashtag = '\\b' + hashtag + '\\b';
    let regHashtag = new RegExp(hashtag, 'gi');

    // Retourne un tableau contenant uniquement les tweets de la tranche horaire
    var arr1 = jsonObj.filter(tweet => {
        let date = new Date(tweet.created_at);
        return date.getFullYear() == day.getFullYear() && date.getMonth() == day.getMonth() && date.getDate() == day.getDate() && date.getHours() >= 1 && date.getHours() <= 23 + 1;

    })

    // Trie le tableau par date
    arr1.sort((tweeta, tweetb) => {
        let datea = new Date(tweeta.created_at);
        let dateb = new Date(tweetb.created_at);

        return datea - dateb
    });


    // Compte le nombre d'occurence du hashtag par heure et crée un objet contenant les informations
    let current_hour = hour_min;
    let arrCompteur = {};
    let compteur = 0;


    for (let i = 0; i < arr1.length; i++) {
        let date = new Date(arr1[i].created_at);

        if (date.getHours() - 1 != current_hour) {
            arrCompteur[current_hour] = compteur;
            current_hour = date.getHours() - 1;
            compteur = 0;
        }

        if ((arr1[i].hashtags.match(regHashtag) || []).length > 0) {
            compteur++;
        }
    }

    arrCompteur[current_hour] = compteur;

    // Convertit l'objet en array
    let arrayCompteur = [];

    // color est pour les graphique, on affiche le periode de temps en couleur rouge, les restes sont bleues
    for(let i = 0; i < 24; i++){
      if (i<hour_max && i>=hour_min) {
        arrayCompteur[i] = { 'hour' : i, 'nbTweets' : arrCompteur[i],'color':'red'};
      }else {
        arrayCompteur[i] = { 'hour' : i, 'nbTweets' : arrCompteur[i],'color':'blue'};
      }
        if(arrayCompteur[i].nbTweets === undefined) arrayCompteur[i].nbTweets = 0;
    }

    return arrayCompteur.filter(function(el) {
      return el != null;
    });;
}

// Top 10 des tweets comportant un hashtag ayant été le plus retweeté
var top10Hashtags = (jsonObj, hashtag) => {
    let top10Retweet = [];

    hashtag = '\\b' + hashtag + '\\b';
    let regHashtag = new RegExp(hashtag, 'gi');

    // Crée un objet { }
    jsonObj.forEach(tweet => {
        if(tweet.hashtags == undefined){
            tweet.hashtags = '';
        }
        if ((tweet.hashtags.match(regHashtag) || []).length > 0) {
            top10Retweet.push({ "id": tweet.id, "retweet_count": tweet.retweet_count });
        }
    });

    top10Retweet.sort((a, b) => b.retweet_count - a.retweet_count);

    top10Retweet = top10Retweet.splice(0, 10);


    return top10Retweet;
}

// Top 10 des auteurs de tweet
var top10Auteurs = (jsonObj) => {
    let top10Auteur = {};
    let top10AuteurArray = [];

    jsonObj.forEach(tweet => {
        if (top10Auteur[tweet.user_screen_name] === undefined) {
            top10Auteur[tweet.user_screen_name] = {
                value: 1,
                user_created_at: tweet.user_created_at,
                user_screen_name: tweet.user_screen_name,
                user_default_profile_image: tweet.user_default_profile_image,
                user_description: tweet.user_description,
                user_favourites_count: tweet.user_favourites_count,
                user_friends_count: tweet.user_friends_count,
                user_location: tweet.user_location,
                user_name: tweet.user_name,
                user_name: tweet.user_name,
                user_statuses_count: tweet.user_statuses_count,
                user_urls: tweet.user_urls,
                user_verified: tweet.user_verified
            };
        } else {
            top10Auteur[tweet.user_screen_name].value++;
        }
    });


    for (let auteur in top10Auteur) {
        top10AuteurArray.push({
            'auteur': auteur,
            'nbTweet': top10Auteur[auteur].value,
            'user_created_at': top10Auteur[auteur].user_created_at,
            'user_screen_name': top10Auteur[auteur].user_screen_name,
            'user_default_profile_image': top10Auteur[auteur].user_default_profile_image,
            'user_description': top10Auteur[auteur].user_description,
            'user_favourites_count': top10Auteur[auteur].user_favourites_count,
            'user_friends_count': top10Auteur[auteur].user_friends_count,
            'user_location': top10Auteur[auteur].user_location,
            'user_name': top10Auteur[auteur].user_name,
            'user_statuses_count': top10Auteur[auteur].user_statuses_count,
            'user_urls': top10Auteur[auteur].user_urls,
            'user_verified': top10Auteur[auteur].user_verified
        });
    }

    top10AuteurArray.sort((a, b) => {
        return b.nbTweet - a.nbTweet;
    });

    top10AuteurArray = top10AuteurArray.splice(0, 10);
    return top10AuteurArray;
}

// Liste des hashtags associés à un hashtag de référence
var associatedHashtags = (jsonObj, refHashtag) =>{
    refHashtag = "\\b" + refHashtag + "\\b";
    let regRefHashtag = new RegExp(refHashtag, "gi");

    let associatedHashtag = {};
    let associatedHashtagArray = [];

    jsonObj.forEach(tweet => {
        if(tweet.hashtags === undefined){
            tweet.hashtags = '';
        }
        tweet.hashtags = tweet.hashtags.split(' ');
        if (JSON.stringify(tweet.hashtags).match(regRefHashtag)) {
            for (let i = 0; i < tweet.hashtags.length; i++) {
                associatedHashtag[tweet.hashtags[i]] = 0;
            }
        }
    });

    for (let hashtag in associatedHashtag) {
        if (!hashtag.match(regRefHashtag)) {
            associatedHashtagArray.push(hashtag);
        }
    }

    return associatedHashtagArray
}

// Visualiser la proportion de tweets par pays/region
var tweetsLocation = (jsonObj, limite) => {
    let locationObj = {};
    let locationArray = [];

    jsonObj.forEach(tweet => {
        if (locationObj[tweet.user_location] === undefined) {
            locationObj[tweet.user_location] = 1;
        } else {
            locationObj[tweet.user_location]++;
        }
    });
    delete locationObj[''];

    for (let location in locationObj) {
        locationArray.push({ 'location': location, 'nbTweets': locationObj[location] });
    }

    locationArray.sort((locationa, locationb) => {
        return locationb.nbTweets - locationa.nbTweets;
    });

    locationArray = locationArray.splice(0, limite);

    return locationArray;
}

// Générations et exportation de graphs vega-lite
var graph = (vegaFile, output, data) => {
    let spec = JSON.parse(fs.readFileSync(vegaFile, "utf-8")); // Charge le fichier vega-lite
    spec.data.values = JSON.stringify(data);

    if (output=="graph1") {
      spec.encoding.color = {
        "field": "color",
        "type": "nominal",
        "scale": null
      }
    }

    var vgSpec = vl.compile(spec).spec; // Transforme la spécification vega-lite en vega

    //Crée une view vega
    var view = new vega.View(vega.parse(vgSpec))
    .renderer("none")
    .initialize();

    view
    .toSVG()
    .then(function(svg) {
      fs.writeFileSync(`./export/${output}.svg`, svg);
    }).catch(function(err) {
      console.error(err);
    });

    view
    .toCanvas()
    .then(function(canvas) {
    fs.writeFileSync(`./export/${output}.png`, canvas.toBuffer());
    })
    .catch(function(err) {
    console.error(err);
    });
};

//Exctraction dans fichier csv classé
var extraction = (jsonObj) => {
    let jsonObjExt = [];
    for (let i = 0; i < jsonObj.length; i++) {

        jsonObjExt[i] = {
            ID: jsonObj[i].id,
            URL: jsonObj[i].urls,
            AUTEUR: jsonObj[i].user_screen_name,
            Presentation_Auteur: jsonObj[i].user_description,
            _Date: jsonObj[i].created_at,
            Texte_du_Tweet: jsonObj[i].text,
            Nombre_de_retweet: jsonObj[i].retweet_count,
            Hashtags_associes: jsonObj[i].hashtags,
        }

    }
    const fields = ['ID', 'URL', 'AUTEUR', 'Presentation_Auteur', 'Date', 'Texte_du_Tweet', 'Nombre_de_retweet', 'Hashtags_associes'];
    const json2csvParser = new J2CP({ fields });
    const csv = json2csvParser.parse(jsonObjExt);
    fs.writeFileSync("./export/export.csv", csv, err => {
        if (err) throw err;
    });

}


// Recherche de tweets selon différents critères
var research = (jsonObj, researchID, researchAuteur, researchDate, researchNbreRT, researchHashtags) => {
    let jsonObjExt = jsonObj;
    if(researchID[0] != '.'){

        jsonObjExt = jsonObj.filter(tweet => {
            for (let i = 0; i < researchID.length; i++) {
                if (researchID[i] == tweet.id) {
                    return true
                }
            }
        })
    }

    if (researchDate[0] !== '.') {
        jsonObjExt = jsonObjExt.filter(tweet => {
            tweet.created_at = new Date(tweet.created_at);

            for (let i = 0; i < researchDate.length; i++) {
                if (researchDate[i].getFullYear() == tweet.created_at.getFullYear()
                    && researchDate[i].getMonth() == tweet.created_at.getMonth()
                    && researchDate[i].getDate() == tweet.created_at.getDate()) {

                    return true
                }
            }
        })
    }

    if(researchAuteur[0] !== '.'){
        jsonObjExt = jsonObjExt.filter(tweet => {
            var bool = false
            for (let i = 0; i < researchAuteur.length; i++) {
                if (researchAuteur[i] == tweet.user_screen_name) {
                    bool = true
                }
            }
            return bool;
        })
    }

    if(researchNbreRT !== '.'){
        jsonObjExt = jsonObjExt.filter(tweet => {
            if (tweet.retweet_count >= Number(researchNbreRT)) {
                return true;
            }
        })
    }

    if (researchHashtags[0] !== '.') {
        jsonObjExt = jsonObjExt.filter(tweet => {
            for (let i = 0; i < researchHashtags.length; i++) {
                researchHashtags[i] = new RegExp(researchHashtags[i], "gi");
                if(tweet.hashtags === undefined){
                    tweet.hashtags = '';
                }
                if (tweet.hashtags.match(researchHashtags[i])) {
                  return true;
                }
            }
        })
    }

    return jsonObjExt;
}


module.exports = {
  csvToJson: csvToJson,
  suppressionRetweets: suppressionRetweets,
  nbTweetsParJournée: nbTweetsParJournée,
  top10Hashtags: top10Hashtags,
  top10Auteurs: top10Auteurs,
  associatedHashtags: associatedHashtags,
  tweetsLocation: tweetsLocation,
  graph: graph,
  extraction: extraction,
  research: research
};
