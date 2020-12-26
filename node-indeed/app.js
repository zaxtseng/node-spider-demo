const URL = require('url')
const md5 = require('md5')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')

const json = (data) => {
    let res
    try {
        res = JSON.parse(data)
    }catch (error){
        console.log(error)
    }
    return res
}

const rules = [
    /\/jobs\?q=.*&sort=date&start=\d+/,
    /\/jobs\?q=&l=.*&sort=date&start=\d+/
]

const fns = {
    start: async (page) => {
        const host = URL.parse(page.url).hostname
        const tasks = []
        try {
            const $ = cheerio.load(iconv.decode(page.con, 'utf-8'), { decodeEntities: false })
            $('#states > tbody > tr > td > a').each((i,ele) => {
                const url = URL.resolve(page.url, $(ele).attr('href'))
                tasks.push({ _id: md5(url), type: 'city', host, url, done: 0, name: $(ele).text() })
            });
            $('#categories > tbody > tr > td > a').each((i, ele) => {
                    const url = URL.resolve(page.url, $(ele).attr('href'));
                    tasks.push({ _id: md5(url), type: 'category', host, url, done: 0, name: $(ele).text() });
                });
            const res = await global.com.task.insertMany(tasks, { ordered: false }).catch(()=> {});
            res && console.log(`${host}-start insert ${res.insertedCount} from ${tasks.length} tasks`)
            return 1

        } catch(err){
            console.error(`${host}-start parse ${page.url} ${err}`)
            return 0
        }
    },

    city: async (page) =>{
        const host = URL.parse(page.url).hostname
        const tasks = []
        const cities = []
        try {
            const $ = cheerio.load(iconv.decode(page.con, 'utf-8'), { decodeEntities: false })
            $('#cities > tbody > tr > td > p.city > a').each((i, ele) => {
                let tmp = $(ele).attr('href').match(/l-(?<loc>.*)-jobs.html/u)
                if(!imp){
                    tmp = $(ele).attr('href').match(/l=(?<loc>.*)/u)
                }
                const { loc } = tmp.groups
                const url = `https://www.indeed.com/jobs?l=${decodeURIComponent(loc)}&sort=date`
                tasks.push({ _id: md5(url), type: 'search',host, url , done: 0 })
                cities.push({ _id: `${$(ele).text()}_${page.name}`, parent: page.name, name: $(ele).text(), url)
            })

                let res = await global.com.city.insertMany(cities, { ordered: false }).catch(()=>{})
                res && console.log(`${host}-city insert ${res.insertedCount} from ${cities.length} cities`)

                res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
                res && console.log(`${host}-city insert ${res.insertedCount} from ${tasks.length} tasks`);
                return 1
        } catch(err){
            console.error(`${host}-city parse ${page.url} ${err}`)
            return 0
        }
    },

    category: async (page) => {
        const host = URL.parse(page.url).hostname;
        const tasks = [];
        const categories = [];
        try {
        const $ = cheerio.load(iconv.decode(page.con, 'utf-8'), { decodeEntities: false });
        $('#titles > tbody > tr > td > p.job > a').each((i, ele) => {
            const { query } = $(ele).attr('href').match(/q-(?<query>.*)-jobs.html/u).groups;
            const url = `https://www.indeed.com/jobs?q=${decodeURIComponent(query)}&sort=date`;
            tasks.push({ _id: md5(url), type: 'search', host, url, done: 0 });
            categories.push({ _id: `${$(ele).text()}_${page.name}`, parent: page.name, name: $(ele).text(), url });
        });
        let res = await global.com.category.insertMany(categories, { ordered: false }).catch(() => {});
        res && console.log(`${host}-category insert ${res.insertedCount} from ${categories.length} categories`);

        res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
        res && console.log(`${host}-category insert ${res.insertedCount} from ${tasks.length} tasks`);
        return 1;
        } catch (err) {
        console.error(`${host}-category parse ${page.url} ${err}`);
        return 0;
        }
    },

}