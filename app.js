const functions = require('./functions.js');
const recursiveReadSync = require('recursive-readdir-sync');
const cli = require('caporal');

const fs = require('fs');

(async () => {
    let files = recursiveReadSync('./donnees');
    let jsonObj = await functions.csvToJson(files);
    cli
      .version("1.00")
      .command("readme", "Affiche le fichier readme.")
      .action(() => {
        fs.readFile("README.md", "utf8", (err, data) => {
          console.log(data);
        });
      })

      // Nombre de tweets sur un hashtag pour une période donnée par journée (Tranche horaire d’heure en heure).
      .command("nombretweetssurperiode", "Nombre de tweets sur un hashtag pour une période donnée par journée")
      .argument("<hashtag>", "Le hashtag dont on souhaite obtenir le nombre de tweets le comportant.")
      .argument("<date>", "Le jour dont on souhaite obtenir des informations (JJ/MM/YYYY)")
      .argument("<heureMin>", "La borne inférieure pour les heures")
      .argument("<heureMax>", "La borne suppérieure pour les heures")
      .option("-g, --exportGraph", "Export a graph aux fichiers nommés graph1", cli.BOOL, false)
      .action((args, options) => {
        let printDate = args.date;

        var sep = RegExp(/\/|-|\./);
        args.date = args.date.split(sep);
        let date = new Date(args.date[2], Number(args.date[1]) - 1, Number(args.date[0]));

        let extraire1 = functions.nbTweetsParJournée(jsonObj, date, Number(args.heureMin), Number(args.heureMax), args.hashtag);

        // Vérification du nombre de présence du hashtag
        let sum = 0;
        for(let i = 0; i < extraire1.length; i++ ){
            if (extraire1[i].color=='red') {
              sum += extraire1[i].nbTweets;
            }
        }

        if(sum === 0 ){
          console.log("\nCe hashtag n'est pas présent sur cette tranche horaire\n");
        }else{
          console.log(`\n\nNombre d'occurence de #${args.hashtag} le ${printDate} : `)
          for(let i = 0; i < extraire1.length; i++){
            if (extraire1[i].color=='red') {
              console.log(`${extraire1[i].hour}h : ${extraire1[i].nbTweets} occurences`);
            }
          }
          console.log('\n');
        }

        if (options.exportGraph) {
          functions.graph("./vega-lite/graph1.json", "graph1", extraire1);
          console.log("Le graphique a été exporté.")
        }
      })

      // Top 10 des tweets comportant un hashtag ayant été le plus retweeté.
      .command("top10retweets", "Top 10 des tweets comportant un hashtag ayant été le plus retweeté.")
      .argument("<hashtag>", "Le hashtag dont on veut générer le top 10")
      .option("-g, --exportGraph", "Exporte des graphiques aux fichiers nommés graph2", cli.BOOL, false)
      .action((args, options) => {
        let extraire2 = functions.top10Hashtags(jsonObj, args.hashtag);



        if(extraire2.length === 0){
          console.log("\nCe hashtag n'a jamais été utilisé\n");
        }else{
          console.log("\nTop 10 des tweets ayant été le plus retweetés : ")
          for(let i = 0; i<extraire2.length; i++){
            console.log(`ID : ${extraire2[i].id}, Nombre de retweets : ${extraire2[i].retweet_count}`)
          }
          console.log('\n')
        }

        if (options.exportGraph) {
          functions.graph("./vega-lite/graph2.json", "graph2", extraire2);
          console.log("Le graphique a été exporté.")
        }
      })

      // Top 10 des auteurs de tweets
      .command("top10auteurs", "Top 10 des auteurs de tweet")
      .action(args => {
        let extraire3 = functions.top10Auteurs(jsonObj);

        console.log("\nTop 10 des auteurs de tweet :\n ")
        extraire3.forEach(auteur => {
          console.log(auteur);
          console.log('\n')
        })
      })

      // Liste des hashtags associés à un hashtag de référence
      .command("listehashtagreferences", "Liste des hashtags associés à un hashtag de référence")
      .argument("<hashtag>", "Le hashtag dont on souhaite obtenir la liste de hashtags associés")
      .action(args => {
        let extraire4 = functions.associatedHashtags(jsonObj, args.hashtag);

        console.log("Tweets associés : ")
        console.log(extraire4);
      })

      // Visualiser la proportion de tweets par pays/régions
      .command("nombretweetsparregion", "Visualiser le nombre de tweets par pays/région")
      .argument("[limite]", "Le nombre maximum de régions souhaitées")
      .option("-g, --exportGraph", "Exporte des graphiques aux fichiers nommés graph3", cli.BOOL, false)
      .action((args, options) => {
        if (args.limite == undefined) args.limite = 20;
        let extraire5 = functions.tweetsLocation(jsonObj, args.limite);

        console.log('');
        extraire5.forEach(element => {
          console.log(`${element.nbTweets} tweets provenant de "${element.location}"`);
        })
        console.log("");

        if (options.exportGraph) {
          extraire5 = functions.tweetsLocation(jsonObj, 20);
          functions.graph("./vega-lite/graph3.json", "graph3", extraire5);
          console.log('\n Le graphique a été exporté.')
        }


      })

      // Rechercher et exporter des listes de tweets
      .command("rechercher", "Rechercher une liste de tweets seln des critères. Saisir . si le critère en question n'est pas désiré.")
      .argument("<ids>", "Liste des ID")
      .argument("<auteurs>", "Liste des auteurs")
      .argument("<dates>", "Liste des dates")
      .argument("<nombreRetweet>", "Nombre de retweet minimum")
      .argument("<hashtags>", "Liste des hashtags")
      .option("-e, --export", "Exporte un fichier csv nommé export", cli.BOOL, false)
      .action((args, options) => {
        let researchID = args.ids.split(","); //liste des ID recherchés
        let researchAuteur = args.auteurs.split(","); //liste des auteurs recherchés

        args.dates = args.dates.split(",");

        let researchDate;
        if (args.dates[0] == ".") {
          researchDate = ".";
        } else {
          researchDate = [];
          for (let i = 0; i < args.dates.length; i++) {
            let date = args.dates[i].split("/");
            let annee = date[2];
            let mois = Number(date[1]);
            let jour = Number(date[0]);

            researchDate[i] = new Date(annee, mois-1, jour );
          }
        }

        let researchNbreRT = args.nombreRetweet;
        let researchHashtags = args.hashtags.split(",");
        let rechercher = functions.research(jsonObj, researchID, researchAuteur, researchDate, researchNbreRT, researchHashtags);


        if(rechercher.length === 0){
          console.log('\nAucun résultat ne correspondant à la recherche.\n');
        }else{
          console.log('\nResultat de la recherche : ');

          rechercher.forEach(element => {
            console.log(`ID : ${element.id}, Tweet : ${element.text}`);
          })
        }


        if (options.export) {
          functions.extraction(rechercher);
          console.log("Le fichier a bien été extrait");
        }
      });


    cli.parse(process.argv);

})().catch(err => {
    console.error(err);
});
