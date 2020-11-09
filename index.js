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

var coachingData = {};
const devToPRList = [];
const jiraAuth = 'empty';

const STORY_POINTS_FIELD_ID = 'customfield_10017';
const secretKey = 'globantao2020';
//must be chronologically sorted
const sprints = {
    '322': 'NAP Sprint 48',
    '331': 'NAP Sprint 49',
    '330': 'NAP Sprint 50',
    '336': 'NAP Sprint 51',
    '345': 'NAP Sprint 51a (1/2)',
    '341': 'NAP Sprint 52',
    '340': 'NAP Sprint 53',
    '350': 'NAP Sprint 54',
    '357': 'NAP Sprint 55',
}

const sprintBlackList = [
    'NAP Sprint 48',
    'NAP Sprint 49',
    'NAP Sprint 50',
    'NAP Sprint 51',
    'NAP Sprint 51a (1/2)',
]

const devWhiteList = [
    'Javier Elizalde Solis',
    'Jhonatan Caceres Acevedo',
    'Jonathan H. Fernández',
    'Juan Francisco Bielma Vargas',
    'Luis Lopez',
    'Roberto Roman',
    'Sprint Summary',
];

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
    }
}

const dateBelongsToSpring = data => {
    const when = moment(data);
    return Object.keys(sprintDates).find(sprint => sprintDates[sprint].startDate <= when && when < sprintDates[sprint].endDate);
}

// Fetches Account Opening issues from Jira
const fetchEverything = async (maxResults, startAt) => {
    const firstDate = Object.values(sprintDates)[0].startDate;
    const lastDate = Object.values(sprintDates).pop().endDate;
    return (await superagent.get('https://atriawealth.atlassian.net/rest/api/3/search')
        .query({
            jql: `project = NAP OR project = NAO AND created >= ${firstDate.format('YYYY-MM-DD')} AND created <= ${lastDate.format('YYYY-MM-DD')}`,
            //query que armamos con ivonne
            //jql: `project = NAP AND issuetype = Bug AND labels in (RCA-BackEnd, RCA-Coding-Issue, RCA-Data-issue, RCA-Design-Issue, RCA-Integration, RCA-Performance-issue, RCA-Environment, RCA-Requirement-Issue) AND labels in (Business_Acc_UAT, Business_QA, Business_Laserapp_QA) AND labels not in (Business_Acc_UAT, Business_QA, Business_Laserapp_QA, RCA-Change-Request, RCA-Duplicated-Issue, RCA-NotReproducible, RCA-Out-Of-Scope-Issue, RCA-Testing-issue) AND created >= 2020-08-31 AND created <= 2020-09-13 ORDER BY created ASC`,
            expand: 'changelog',
            maxResults,
            startAt
        })
        .set('Authorization', jiraAuth)).body;
}

const fetchWorklogs = async (ids) => {
    return (await superagent.post('https://atriawealth.atlassian.net/rest/api/3/search')
        .send({
            ids
        })
        .set('Authorization', jiraAuth)).body;
}

const getAllIssues = async () => {
    if (fsOld.existsSync(`__cache__`)) {
        const cache = await fs.readFile(`__cache__`)
        return JSON.parse(cache);
    }
    const step = 100;
    let startAt = 0;
    let results = [];
    let res = { total: 1, startAt: 0, maxResults: 0 };
    while (res.startAt + res.maxResults < res.total) {
        res = await fetchEverything(step, startAt);
        results = results.concat(res.issues);
        startAt += step;
        console.log(chalk.yellow(`Fetched ${chalk.green(Math.min(startAt, res.total))} of ${chalk.green(res.total)} results`));
    }
    return results
};



const initSprints = () => {
    const sprintData = {};
    Object.values(sprints).forEach(sprint => {
        sprintData[sprint] = {
            devStats: {},
            bugStats: {
                valid: [],
                invalid: [],
                uncategorized: []
            }
        }
    });
    return sprintData;
}

const whoAndWhenItWasFirstFinished = (jiraIssue, issues) => {
    if (issues && jiraIssue.fields.issuetype.name === 'Sub-task' && jiraIssue.fields.parent) {
        jiraIssue = issues.find(is => is.key === jiraIssue.fields.parent.key) || jiraIssue
    }
    const histories = jiraIssue.changelog.histories || [];
    const firstClosed = histories
        .filter(history => (history.items || []).find(item => {
            if (jiraIssue.fields.issuetype.name === 'Sub-task') {
                return true;
            }
            return item.field === 'status' && item.toString === 'PR Review';
        }))
        .sort((historyA, historyB) => moment(historyA.created) > moment(historyB.created) ? 1 : -1)
    [0];
    if (firstClosed && dateBelongsToSpring(firstClosed.created)) {
        return {
            sprint: dateBelongsToSpring(firstClosed.created),
            who: firstClosed.author.displayName
        }
    }
}

const createDev = (data, sprint, dev) => {

    if (data[sprint].devStats[dev] || !devWhiteList.includes(dev)) {
        return;
    }
    data[sprint].devStats[dev] = {
        stories: [],
        bugs: [],
        timeTracked: [],
        summary: {
            totalStories: 0,
            totalStoryPoints: 0,
            totalBugs: 0,
            totalTimeTrackedS: 0,
            totalTimeTrackedM: 0,
            totalTimeTrackedH: 0,
        }
    }


}

const updateWorkLog = (data, issue, issues) => {
    issue.changelog.histories
        .filter(history => history.items.find(item => item.field === 'timespent') && dateBelongsToSpring(history.created))
        .forEach(history => {
            if (!devWhiteList.includes(history.author.displayName)) {
                return true;
            }
            history.items.filter(item => item.field === 'timespent').forEach(item => {
                const parent = issue.fields.parent && issue.fields.parent.key;
                const type = issue.fields.issuetype.name;
                const parentType = issue.fields.parent && issue.fields.parent.fields.issuetype.name;
                const whoAndWhen = whoAndWhenItWasFirstFinished(issue, issues);
                const sprint = whoAndWhen ? whoAndWhen.sprint : dateBelongsToSpring(history.created);
                createDev(data, sprint, history.author.displayName);
                data[sprint].devStats[history.author.displayName].timeTracked.push({
                    id: issue.key,
                    description: issue.fields.summary,
                    timeS: (parseInt(item.to) - parseInt(item.from || '0')),
                    timeM: (parseInt(item.to) - parseInt(item.from || '0')) / 60,
                    timeH: (parseInt(item.to) - parseInt(item.from || '0')) / (60 * 60),
                    parent,
                    parentType,
                    type
                })
            })
        })
}

const parseIssue = (data, attr, sprint, dev, issue) => {
    if (!devWhiteList.includes(dev)) {
        return;
    }
    data[sprint].devStats[dev][attr].push({
        id: issue.key,
        description: issue.fields.summary,
        storyPoints: issue.fields[STORY_POINTS_FIELD_ID] || 0
    })
}

const checkIfBugIsValid = jiraIssue => {
    const validBugLabels = ['RCA-BackEnd',
        'RCA-Coding-Issue',
        'RCA-Data-issue',
        'RCA-Design-Issue',
        'RCA-Integration',
        'RCA-Performance-issue',
        'RCA-Environment',
        'RCA-Requirement-Issue'];
    return jiraIssue.fields.labels.find(label => validBugLabels.includes(label));
}

const postProcess = (data, devToPRList) => {
    const devtoprList = devToPRList;
    Object.keys(data).forEach(sprint => {
        createDev(data, sprint, 'Sprint Summary')
        Object.keys(data[sprint].devStats).filter(dev => dev !== 'Sprint Summary').forEach(dev => {
            data[sprint].devStats[dev].summary = {
                totalStories: data[sprint].devStats[dev].stories.length,
                totalStoryPoints: data[sprint].devStats[dev].stories.reduce((acc, curr) => acc + curr.storyPoints, 0),
                totalBugs: data[sprint].devStats[dev].bugs.length,
                totalTimeTrackedS: data[sprint].devStats[dev].timeTracked.reduce((acc, curr) => acc + curr.timeS, 0),
                totalTimeTrackedM: data[sprint].devStats[dev].timeTracked.reduce((acc, curr) => acc + curr.timeM, 0),
                totalTimeTrackedH: data[sprint].devStats[dev].timeTracked.reduce((acc, curr) => acc + curr.timeH, 0),
            }
            const attrs = (['totalStories', 'totalStoryPoints', 'totalBugs', 'totalTimeTrackedS', 'totalTimeTrackedM', 'totalTimeTrackedH']);
            attrs.forEach(attr => {
                data[sprint].devStats['Sprint Summary'].summary[attr] += data[sprint].devStats[dev].summary[attr];
            })
            data[sprint].devStats['Sprint Summary'].stories = data[sprint].devStats['Sprint Summary'].stories.concat(data[sprint].devStats[dev].stories)
            data[sprint].devStats['Sprint Summary'].bugs = data[sprint].devStats['Sprint Summary'].bugs.concat(data[sprint].devStats[dev].bugs)
            data[sprint].devStats['Sprint Summary'].timeTracked = data[sprint].devStats['Sprint Summary'].timeTracked.concat(data[sprint].devStats[dev].timeTracked)
            data[sprint].devStats['Sprint Summary'].devToPr = devtoprList.filter(elem => elem.sprint === sprint);
        });
    });
}

const updateWorklogs = (data) => {
    Object.keys(data).forEach(sprint => {
        Object.keys(data[sprint].devStats).filter(dev => dev !== 'Sprint Summary').forEach(dev => {
            data[sprint].devStats[dev].summary = {
                totalStories: data[sprint].devStats[dev].stories.length,
                totalStoryPoints: data[sprint].devStats[dev].stories.reduce((acc, curr) => acc + curr.storyPoints, 0),
                totalBugs: data[sprint].devStats[dev].bugs.length,
                totalTimeTrackedS: data[sprint].devStats[dev].timeTracked.reduce((acc, curr) => acc + curr.timeS, 0),
                totalTimeTrackedM: data[sprint].devStats[dev].timeTracked.reduce((acc, curr) => acc + curr.timeM, 0),
                totalTimeTrackedH: data[sprint].devStats[dev].timeTracked.reduce((acc, curr) => acc + curr.timeH, 0),
                // histories
            }
            const attrs = (['totalStories', 'totalStoryPoints', 'totalBugs', 'totalTimeTrackedS', 'totalTimeTrackedM', 'totalTimeTrackedH']);
            attrs.forEach(attr => {
                data[sprint].devStats['Sprint Summary'].summary[attr] += data[sprint].devStats[dev].summary[attr];

            })
            data[sprint].devStats['Sprint Summary'].stories = data[sprint].devStats['Sprint Summary'].stories.concat(data[sprint].devStats[dev].stories)
            data[sprint].devStats['Sprint Summary'].bugs = data[sprint].devStats['Sprint Summary'].bugs.concat(data[sprint].devStats[dev].bugs)
            data[sprint].devStats['Sprint Summary'].timeTracked = data[sprint].devStats['Sprint Summary'].timeTracked.concat(data[sprint].devStats[dev].timeTracked)
        });
    });
}

const bugAnalysis = (issues, finalResult) => {
    const rejectableLabels = ['RCA-Change-Request',
        'RCA-Duplicated-Issue',
        'RCA-NotReproducible',
        'RCA-Out-Of-Scope-Issue',
        'RCA-Testing-Issue'];
    const acceptedLabels = [
        'RCA-BackEnd',
        'RCA-Coding-Issue',
        'RCA-Data-issue',
        'RCA-Design-Issue',
        'RCA-Integration',
        'RCA-Performance-issue',
        'RCA-Environment',
        'RCA-Requirement-Issue',
        ...rejectableLabels,
    ];

    issues
        .filter(issue => ['Bug'].includes(issue.fields.issuetype.name))
        .forEach(bug => {
            const sprint = dateBelongsToSpring(bug.fields.created);
            //revisar JORGE
            const parent = bug.fields.issuelinks[0] != undefined && bug.fields.issuelinks[0].type != undefined && bug.fields.issuelinks[0].name === 'Relates'?  bug.fields.issuelinks[0].type.id : '--';
            if (!sprint) {
                return true;
            }
            if (!bug.fields.labels.some(label => acceptedLabels.includes(label))) {
                finalResult[sprint].bugStats.uncategorized.push({
                    id: bug.key,
                    description: bug.fields.summary,
                    labels: bug.fields.labels.join(' / '),
                    coachingDev: coachingData[bug.key] ? coachingData[bug.key].dev : '--',
                    coachingActions: coachingData[bug.key] ? coachingData[bug.key].coahing_output : '--',
                    parent: parent
                });
            } else if (bug.fields.labels.some(label => rejectableLabels.includes(label))) {
                finalResult[sprint].bugStats.invalid.push({
                    id: bug.key,
                    description: bug.fields.summary,
                    labels: bug.fields.labels.filter(lbl => acceptedLabels.includes(lbl)).join(' / '),
                    coachingDev: coachingData[bug.key] ? coachingData[bug.key].dev : '--',
                    coachingActions: coachingData[bug.key] ? coachingData[bug.key].coahing_output : '--',
                    parent: parent
                });
            } else {
                finalResult[sprint].bugStats.valid.push({
                    id: bug.key,
                    description: bug.fields.summary,
                    labels: bug.fields.labels.filter(lbl => acceptedLabels.includes(lbl)).join(' / '),
                    coachingDev: coachingData[bug.key] ? coachingData[bug.key].dev : '--',
                    coachingActions: coachingData[bug.key] ? coachingData[bug.key].coahing_output : '--',
                    parent: parent
                });
            }
        })
}

const readStream = (stream, encoding = "utf8") => {

}

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

const checkDevToPRIssue = (jiraIssue) => {
    const issue = jiraIssue;
    let devToPR = jiraIssue.changelog.histories.map(elem => {
        let temp = elem.items.filter(item => {
            if (item.fromString === "In DEV" && item.toString === "PR Review") {
                return item;
            }
        })
        return {item: temp, created: elem.created}
    }).filter(elem => elem.item.length > 0)
    .sort((a,b) => a.created > b.created ? 1 : -1);
    
    if(devToPR.length > 0){
        let sprint = dateBelongsToSpring(devToPR[0].created);
        devToPRList.push({id: jiraIssue.id, key: jiraIssue.key, self: jiraIssue.self, devToPrItems: devToPR, sprint: sprint});
    }

}

// ------------------------------ MAIN BLOCK - Start ----------------------------------------------
(async () => {
    try {
        coachingData = await getCoachingData();
        const finalResult = initSprints();
        const issues = await getAllIssues();
       
        fs.writeFile(`__cache__`.replace('/', '%'), JSON.stringify(issues))
        issues.forEach(jiraIssue => {
            if (jiraIssue.key === 'NAP-5787') {
                return true;
            }
            updateWorkLog(finalResult, jiraIssue, issues)
            const whoAndWhen = whoAndWhenItWasFirstFinished(jiraIssue);
            if (!whoAndWhen || !whoAndWhen.sprint) {
                return true;
            }
            createDev(finalResult, whoAndWhen.sprint, whoAndWhen.who);
            if (['Story'].includes(jiraIssue.fields.issuetype.name)) {
                parseIssue(finalResult, 'stories', whoAndWhen.sprint, whoAndWhen.who, jiraIssue);
                checkDevToPRIssue(jiraIssue); 
            } else if (['Bug'].includes(jiraIssue.fields.issuetype.name) && checkIfBugIsValid(jiraIssue)) {
                parseIssue(finalResult, 'bugs', whoAndWhen.sprint, whoAndWhen.who, jiraIssue);
            }
            
        });
        postProcess(finalResult, devToPRList)
        bugAnalysis(issues, finalResult);
        sprintBlackList.forEach(sprint => {
            delete finalResult[sprint];
        });

        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(finalResult), secretKey.trim()).toString();
        fs.writeFile('devstats/src/assets/raw-data.json', encrypted);
        //console.log(util.inspect(finalResult,true,1000,true));
        console.log(finalResult);
    } catch (err) {
        console.error(err);
    }
})();
// ------------------------------ MAIN BLOCK -  End  ----------------------------------------------

