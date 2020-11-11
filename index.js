const superagent = require('superagent');
const fsOld = require('fs');
const fs = fsOld.promises;
const util = require('util');
const { exit } = require('process');
const CryptoJS = require('crypto-js');
const moment = require('moment'); // require
const removeDuplicates = require('removeDuplicates');
const chalk = require('chalk');
const { Parser } = require('json2csv');
const csv = require('csv-parser');
require('dotenv').config();

var coachingData = {};
const devToPRList = [];
const jiraAuth = `Basic ${process.env['JIRA_TOKEN']}`;
const issueMap = {};
const STORY_POINTS_FIELD_ID = 'customfield_10017';
const secretKey = 'globantao2020';
//must be chronologically sorted
const sprintDates = {
    'NAP Sprint 48': {
        startDate: moment('29-06-2020', 'DD-MM-YYYY'),
        endDate: moment('13-07-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 49': {
        startDate: moment('13-07-2020', 'DD-MM-YYYY'),
        endDate: moment('27-07-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 50': {
        startDate: moment('27-07-2020', 'DD-MM-YYYY'),
        endDate: moment('10-08-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 51': {
        startDate: moment('10-08-2020', 'DD-MM-YYYY'),
        endDate: moment('24-08-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 51a (1/2)': {
        startDate: moment('24-08-2020', 'DD-MM-YYYY'),
        endDate: moment('31-08-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 52': {
        startDate: moment('31-08-2020', 'DD-MM-YYYY'),
        endDate: moment('13-09-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 53': {
        startDate: moment('14-09-2020', 'DD-MM-YYYY'),
        endDate: moment('27-09-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 54': {
        startDate: moment('28-09-2020', 'DD-MM-YYYY'),
        endDate: moment('11-10-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 55': {
        startDate: moment('12-10-2020', 'DD-MM-YYYY'),
        endDate: moment('25-10-2020', 'DD-MM-YYYY')
    },
    'NAP Sprint 56': {
        startDate: moment('26-10-2020 ', 'DD-MM-YYYY'),
        endDate: moment('08-11-2020', 'DD-MM-YYYY')
    }
}

const devWhiteList = [
    'Javier Elizalde Solis',
    'Jhonatan Caceres Acevedo',
    'Jonathan H. Fernández',
    'Juan Francisco Bielma Vargas',
    'Luis Lopez',
    'Roberto Roman',
    'Sprint Summary',
];

const dateBelongsToSpring = data => {
    const when = moment(data);
    return Object.keys(sprintDates).find(sprint => sprintDates[sprint].startDate <= when && when < sprintDates[sprint].endDate);
}

const whenItWasFirstFinished = (issue) => {
    const parent = issue.fields.parent && issue.fields.parent.key;
    const parentType = issue.fields.parent && issue.fields.parent.fields.issuetype.name;
    if (parentType && ['Bug', 'Story'].includes(parentType)) {
        issue = issueMap[parent];
    }
    const histories = issue.changelog.histories || [];
    const firstClosed = histories
        .filter(history => (history.items || []).find(item => {
            if (issue.fields.issuetype.name === 'Sub-task') {
                return true;
            }
            return item.field === 'status' && item.toString === 'PR Review';
        }))
        .sort((historyA, historyB) => moment(historyA.created) > moment(historyB.created)? 1 : -1)
        [0];
    if (firstClosed && dateBelongsToSpring(firstClosed.created)) {
        return dateBelongsToSpring(firstClosed.created);
    }
    return null;
}

// Fetches Account Opening issues from Jira
const fetchEverything = async (maxResults, startAt) => {
    const firstDate = Object.values(sprintDates)[0].startDate;
    const lastDate = Object.values(sprintDates).pop().endDate;
    return (await superagent.get('https://atriawealth.atlassian.net/rest/api/3/search')
        .query({
            jql: `project = NAP OR project = NAO`,
            //query que armamos con ivonne
            //jql: `project = NAP AND issuetype = Bug AND labels in (RCA-BackEnd, RCA-Coding-Issue, RCA-Data-issue, RCA-Design-Issue, RCA-Integration, RCA-Performance-issue, RCA-Environment, RCA-Requirement-Issue) AND labels in (Business_Acc_UAT, Business_QA, Business_Laserapp_QA) AND labels not in (Business_Acc_UAT, Business_QA, Business_Laserapp_QA, RCA-Change-Request, RCA-Duplicated-Issue, RCA-NotReproducible, RCA-Out-Of-Scope-Issue, RCA-Testing-issue) AND created >= 2020-08-31 AND created <= 2020-09-13 ORDER BY created ASC`,
            expand: 'changelog',
            maxResults,
            startAt
        })
        .set('Authorization', jiraAuth)).body;
}

const getAllIssues = async () => {
    if (fsOld.existsSync(`__cache__`)) {
        const cache = await fs.readFile(`__cache__`)
        return JSON.parse(cache);
    }
    const step = 100;
    let counter = 0;
    const atATime = 15;
    let startAt = 0;
    let results = [];
    let res = { total: 1, startAt: 0, maxResults: 0 };
    const promises = [];
    promises.push(fetchEverything(step, startAt));
    startAt += step;
    res = await promises[0];
    while (startAt < res.total) {
        counter++;
        promises.push(fetchEverything(step, startAt))
        startAt += step;
        if (counter >= atATime || (startAt + step) >= res.total) {
            counter = 0;
            console.log(chalk.yellow(`Fetching ${chalk.green(Math.min(startAt, res.total))} of ${chalk.green(res.total)} results`));
            await Promise.all(promises);
            console.log(chalk.yellow(`${chalk.green('OK')}`));
        }
    }
    console.log(chalk.yellow(`Fetching ${chalk.green(Math.min(startAt, res.total))} of ${chalk.green(res.total)} results`));
    (await Promise.all(promises)).forEach(res => {
        results = results.concat(res.issues);
    })
    fs.writeFile(`__cache__`.replace('/', '%'), JSON.stringify(results))
    return results
};


// Un bug es valido si tiena alguno de estos labels
const checkIfBugIsValid = jiraIssue => {
    const validBugLabels = [
        'RCA-Valid',
        'RCA-BackEnd',
        'RCA-Coding-Issue',
        'RCA-Data-issue',
        'RCA-Design-Issue',
        'RCA-Integration',
        'RCA-Performance-issue',
        'RCA-Environment',
        'RCA-Requirement-Issue'];
    return jiraIssue.fields.labels.some(label => validBugLabels.includes(label));
}


// El bug es invalido si tiene alguno de estos labels
const checkIfBugIsInvalid = jiraIssue => {
    const invalidBugLabels = [
        'RCA-Change-Request',
        'RCA-Duplicated-Issue',
        'RCA-NotReproducible',
        'RCA-Out-Of-Scope-Issue',
        'RCA-Testing-issue',
        'RCA-Testing-Issue'
    ];
    return jiraIssue.fields.labels.some(label => !checkIfBugIsValid(jiraIssue) && invalidBugLabels.includes(label));
}

// El bug es other si no es ni valido ni invalido
const checkIfBugIsOther = jiraIssue => !checkIfBugIsValid(jiraIssue) && !checkIfBugIsInvalid(jiraIssue);

// Obtiene un issue a partir de su key, ej NAP-1323
getIssueByKey = key => issueMap[key];

// No lo estoy usando en este momento pero aqui en este csv estan los datos de coaching
const getCoachingData = async () => {
    return new Promise((resolve, reject) => {
        const data = {};
        const stream = fsOld.createReadStream('coaching.csv')
            .pipe(csv({ separator: ';' }))
        stream.on("data", row => {
            data[row.issue_key] = JSON.parse(JSON.stringify(row));
        });
        stream.on("end", () => {
            resolve(data)
        });
        stream.on("error", error => reject(error));
    });
}

// Para un sprint obtiene todas las historias movidas por primera vez a PT
const getStoriesDoneOnSprint = (sprint, issues) => 
    // Para todos los issues
    issues
    // que sean story's
    .filter(jiraIssue => jiraIssue.fields.issuetype.name === 'Story')
    // que se hayan movido a PR Review por primera vez este sprint
    .filter(jiraIssue => {
        const firstTimeItWasMovedToPR = jiraIssue.changelog.histories
            .sort((a,b) => a.created > b.created? 1 : -1)
            .filter(history => history.items.find(item => item.field === 'status' && item.toString === 'PR Review'))[0]
        return firstTimeItWasMovedToPR && sprint === dateBelongsToSpring(firstTimeItWasMovedToPR.created)
    }
)

// Para un sprint obtiene todos los bugs creados
const getBugsCreatedOnSprint = (sprint, issues) => 
    // Para todos los issues
    issues
    // que sean bugs
    .filter(jiraIssue => jiraIssue.fields.issuetype.name === 'Bug')
    // que la fecha de creación pertenezca a este sprint
    .filter(jiraIssue => sprint === dateBelongsToSpring(jiraIssue.fields.created));

// Para un sprint obtiene todos los bugs asociados a historias que se movieron a PR durante el sprint
const getBugsGeneratedOnSprint = (sprint, issues, storiesDone) => {
    if (!storiesDone) {
        // si no me dieorn las historias movidas a PR las calculo
        storiesDone = getStoriesDoneOnSprint(sprint, issues);
    }
    const linkedIssues = [];
    // para cada historia movida a PR por primera vez en el sprint
    storiesDone.forEach(story => {
        if (!story.fields.issuelinks) {
            // Si la historia no tiene links no me importa
            return true;
        }
        // Los links a esta historia del tipo Relates y Bloocks
        story.fields.issuelinks.filter(link => ['Relates','Blocks']
        // Asociados a un bug
        .includes(link.type.name) && (link.inwardIssue || link.outwardIssue).fields.issuetype.name === 'Bug')
        // Los añado a mi resultado, con su key, y la historia asociada
        .forEach( link => linkedIssues.push({
            key: (link.inwardIssue || link.outwardIssue).key,
            story
        }));
    })
    // Y al final por cada uno de resultados
    return linkedIssues
                // Solo me interesan los que conocemos (que son de NAP o NAO)
                .filter(issue => getIssueByKey(issue.key))
                // con este formato
                .map(issue => ({
                    ...getIssueByKey(issue.key),
                    story: issue.story,
                    reviewStatus: checkIfBugIsValid(getIssueByKey(issue.key))? 'valid'
                                  : checkIfBugIsInvalid(getIssueByKey(issue.key))? 'invalid'
                                  : 'other',
                }))
}

const buildSummaryData = (sprint, issues) => {
    const storiesDone = getStoriesDoneOnSprint(sprint, issues);
    const bugsCreated = getBugsCreatedOnSprint(sprint, issues);
    const bugsGenerated = getBugsGeneratedOnSprint(sprint, issues, storiesDone);
    return {
        totalStoriesDone: storiesDone.length,
        totalBugsCreated: bugsCreated.length,
        totalBugsGenerated: bugsGenerated.length,
    }
}

const buildStoriesDone = (sprint, issues) => {
    const storiesDone = getStoriesDoneOnSprint(sprint, issues);
    return storiesDone.map(story => ({
        key: story.key,
        summary: story.fields.summary
    }))
}

const buildBugsCreatedData = (sprint, issues) => {
    const bugsCreated = getBugsCreatedOnSprint(sprint, issues);
    const valid = bugsCreated.filter(checkIfBugIsValid);
    const invalid = bugsCreated.filter(checkIfBugIsInvalid);
    const other = bugsCreated.filter(checkIfBugIsOther);
    return {
        totalValid: valid.length,
        totalInvalid: invalid.length,
        totalOther: other.length,
        total: bugsCreated.length,
        bugs: [
            ...valid.map(bug => ({reviewStatus: 'valid', ...bug})),
            ...invalid.map(bug => ({reviewStatus: 'invalid', ...bug})),
            ...other.map(bug => ({reviewStatus: 'other', ...bug}))
        ].map(bug => ({
            key: bug.key,
            summary: bug.fields.summary,
            reviewStatus: bug.reviewStatus,
        }))
    }
}

const buildBugsGeneratedData = (sprint, issues) => {
    const bugsGenerated = getBugsGeneratedOnSprint(sprint, issues);
    const storiesDone = getStoriesDoneOnSprint(sprint, issues);
    return {
        total: bugsGenerated.length,
        totalValid: bugsGenerated.filter(bug => bug.reviewStatus === 'valid').length,
        totalInvalid: bugsGenerated.filter(bug => bug.reviewStatus === 'invalid').length,
        totalOther: bugsGenerated.filter(bug => bug.reviewStatus === 'other').length,
        qaCompletition: (storiesDone.filter(issue => ['UAT Deploy','Ready for PROD', 'Closed', 'IN UAT'].includes(issue.fields.status.name)).length*100/storiesDone.length).toFixed(2),
        uatCompletition: (storiesDone.filter(issue => ['Ready for PROD', 'Closed'].includes(issue.fields.status.name)).length*100/storiesDone.length).toFixed(2),
        bugs: bugsGenerated.map(bug => ({
            key: bug.key,
            summary: bug.fields.summary,
            reviewStatus: bug.reviewStatus,
            story: {
                key: bug.story.key,
                summary: bug.story.fields.summary,
            }
        })),
    }
}

// Para los timetracks
const buildTimeTracks = (sprint, issues) => {
    const timeMap = {};
    const results = [];
    // Por cada issue del sprint
    issues.forEach(issue => {
        // reviso sus logs de cambio
        issue.changelog.histories
        // me interesan los cambios en el timespent si el issues es un bug o story terminado este sprint, o si su padre es un bug o story terminado este sprint, de lo contrario me interesa si su fecha de creación es de este sprint
        .filter(history => history.items.find(item => item.field === 'timespent') 
                                && (['Story', 'Bug'].includes(issue.fields.issuetype.name)? sprint === whenItWasFirstFinished(issue)
                                    : issue.fields.parent && ['Story', 'Bug'].includes(issue.fields.parent.fields.issuetype.name)? sprint === whenItWasFirstFinished(issueMap[issue.fields.parent.key])
                                    : sprint === dateBelongsToSpring(history.created)))
        //para cada history
        .forEach(history => {
            // solo me interesa las de mis developers
            if (!devWhiteList.includes(history.author.displayName)) {
                return true;
            }
            // caalculo el tiempo invertido en cada evento y lo voy sumando
            history.items.filter(item => item.field === 'timespent').forEach(item => {
                const parent = issue.fields.parent && issue.fields.parent.key;
                const parentType = issue.fields.parent && issue.fields.parent.fields.issuetype.name;
                const type = parentType && ['Bug', 'Story'].includes(parentType)? parentType:  issue.fields.issuetype.name;
                const key = parentType && ['Bug', 'Story'].includes(parentType)? parent : issue.key;
                const author = history.author.displayName;
                const summary = issueMap[key].fields.summary;
                if (!timeMap[key]) {
                    timeMap[key] = {
                        key,
                        type,
                        summary,
                        devs: {}
                    };
                }
                if (!timeMap[key].devs[author]) {
                    timeMap[key].devs[author] = 0;
                }
                timeMap[key].devs[author] += (parseInt(item.to) - parseInt(item.from || '0'));
            })
        })
   });
   // En este punto tenfo un mapa de ssueKey->dev->time, ahora lo convierto en un formato fácil para mostrarlo en pantalla
   Object.values(timeMap).forEach(timeTrack => {
       Object.keys(timeTrack.devs).forEach(dev => {
           results.push({
               key: timeTrack.key,
               type: timeTrack.type,
               summary: timeTrack.summary,
               dev,
               timeS: timeTrack.devs[dev],
               timeM: timeTrack.devs[dev] / 60,
               timeH: timeTrack.devs[dev] / 60 / 60,
           });
       });
   });
   return results;
}

const buildSprintData = (sprint, issues) => ({
    // Genero el resumen
    summary: buildSummaryData(sprint, issues),
    // Genero las historias movidas a PR por primera vez
    storiesDone: buildStoriesDone(sprint,issues),
    // Genero los bugs creados durante
    bugsCreated: buildBugsCreatedData(sprint, issues),
    // Genero los bugs asociados a las historias movidas a PR por primera vez
    bugsGenerated: buildBugsGeneratedData(sprint, issues),
    // Genero los timetracks de este sprint
    timeTracks: buildTimeTracks(sprint, issues),
});

// ------------------------------ MAIN BLOCK - Start ----------------------------------------------
(async () => {
    try {
        coachingData = await getCoachingData();
        // Para todos los issues que existen en Jira de Account Opening
        const issues = await getAllIssues();
        issues.forEach(issue => {
            // Esto come memoria pero me ayuda a conseguir un issue por su llave sin tener que iterar por miles de entradas
            issueMap[issue.key] = issue;
        })
        const finalResult = {}
        Object.keys(sprintDates).forEach(sprint => {
            // Genero la data de cada sprint
            finalResult[sprint] = buildSprintData(sprint, issues)
        })
        // Encripto la data
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(finalResult), secretKey.trim()).toString();
        // La copio en la app de angular
        fs.writeFile('devstats/src/assets/raw-data.json', encrypted);
        Object.keys(finalResult).forEach(sprint => {
            console.log(`${chalk.yellow(`For ${sprint}`)} there is a ${chalk.green(`QA completition`)} of ${chalk.green(`${finalResult[sprint].bugsGenerated.qaCompletition}%`)}`)
            console.log(`${chalk.yellow(`For ${sprint}`)} there is a ${chalk.green(`UAT completition`)} of ${chalk.green(`${finalResult[sprint].bugsGenerated.uatCompletition}%`)}`)
            console.log('-----------')
        })
    } catch (err) {
        console.error(err);
    }
})();
// ------------------------------ MAIN BLOCK -  End  ----------------------------------------------

