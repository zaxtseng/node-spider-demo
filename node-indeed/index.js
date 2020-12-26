const URL = require('url');
const md5 = require('md5');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const json = (data) => {
  let res;
  try {
    res = JSON.parse(data);
  } catch (err) {
    console.error(err);
   }
  return res;
};

const rules = [
  /\/jobs\?q=.*&sort=date&start=\d+/,
  /\/jobs\?q=&l=.*&sort=date&start=\d+/
];

const fns = {

  start: async (page) => {
    const host = URL.parse(page.url).hostname;
    const tasks = [];
    try {
      const $ = cheerio.load(iconv.decode(page.con, 'utf-8'), { decodeEntities: false });
      $('#states > tbody > tr > td > a').each((i, ele) => {
        const url = URL.resolve(page.url, $(ele).attr('href'));
        tasks.push({ _id: md5(url), type: 'city', host, url, done: 0, name: $(ele).text() });
      });
      $('#categories > tbody > tr > td > a').each((i, ele) => {
        const url = URL.resolve(page.url, $(ele).attr('href'));
        tasks.push({ _id: md5(url), type: 'category', host, url, done: 0, name: $(ele).text() });
      });
      const res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
      res && console.log(`${host}-start insert ${res.insertedCount} from ${tasks.length} tasks`);
      return 1;
    } catch (err) {
      console.error(`${host}-start parse ${page.url} ${err}`);
      return 0;
    }
  },

  city: async (page) => {
    const host = URL.parse(page.url).hostname;
    const tasks = [];
    const cities = [];
    try {
      const $ = cheerio.load(iconv.decode(page.con, 'utf-8'), { decodeEntities: false });
      $('#cities > tbody > tr > td > p.city > a').each((i, ele) => {
        // https://www.indeed.com/l-Charlotte,-NC-jobs.html
        let tmp = $(ele).attr('href').match(/l-(?<loc>.*)-jobs.html/u);
        if (!tmp) {
          tmp = $(ele).attr('href').match(/l=(?<loc>.*)/u);
        }
        const { loc } = tmp.groups;
        const url = `https://www.indeed.com/jobs?l=${decodeURIComponent(loc)}&sort=date`;
        tasks.push({ _id: md5(url), type: 'search', host, url, done: 0 });
        cities.push({ _id: `${$(ele).text()}_${page.name}`, parent: page.name, name: $(ele).text(), url });
      });
      let res = await global.com.city.insertMany(cities, { ordered: false }).catch(() => {});
      res && console.log(`${host}-city insert ${res.insertedCount} from ${cities.length} cities`);

      res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
      res && console.log(`${host}-city insert ${res.insertedCount} from ${tasks.length} tasks`);
      return 1;
    } catch (err) {
      console.error(`${host}-city parse ${page.url} ${err}`);
      return 0;
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

  search: async (page) => {
    const host = URL.parse(page.url).hostname;
    const tasks = [];
    const durls = [];
    try {
      const con = iconv.decode(page.con, 'utf-8');
      const $ = cheerio.load(con, { decodeEntities: false });
      const list = con.match(/jobmap\[\d+\]= {.*}/g);
      const jobmap = [];
      if (list) {
         // eslint-disable-next-line no-eval
        list.map((item) => eval(item));
      }
      for (const item of jobmap) {
        const cmplink = URL.resolve(page.url, item.cmplnk);
        const { query } = URL.parse(cmplink, true);
        let name;
        if (query.q) {
          // eslint-disable-next-line prefer-destructuring
          name = query.q.split(' #')[0].split('#')[0];
        } else {
          const tmp = cmplink.match(/q-(?<text>.*)-jobs.html/u);
          if (!tmp) {
            // eslint-disable-next-line no-continue
            continue;
          }
          const { text } = tmp.groups;
          // eslint-disable-next-line prefer-destructuring
          name = text.replace(/-/g, ' ').split(' #')[0];
        }
        const surl = `https://www.indeed.com/cmp/_cs/cmpauto?q=${name}&n=10&returnlogourls=1&returncmppageurls=1&caret=8`;
        const burl = `https://www.indeed.com/viewjob?jk=${item.jk}&from=vjs&vjs=1`;
        const durl = `https://www.indeed.com/rpc/jobdescs?jks=${item.jk}`;
        tasks.push({ _id: md5(surl), type: 'suggest', host, url: surl, done: 0 });
        tasks.push({ _id: md5(burl), type: 'brief', host, url: burl, done: 0 });
        durls.push({ _id: md5(durl), type: 'detail', host, url: durl, done: 0 });
      }
      $('a[href]').each((i, ele) => {
        const tmp = URL.resolve(page.url, $(ele).attr('href'));
        const [url] = tmp.split('#');
        const { path, hostname } = URL.parse(url);
        for (const rule of rules) {
          if (rule.test(path)) {
            if (hostname == host) {
              // tasks.push({ _id: md5(url), type: 'list', host, url: decodeURI(url), done: 0 });
            }
            break;
          }
        }
      });

      let res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
      res && console.log(`${host}-search insert ${res.insertedCount} from ${tasks.length} tasks`);

      res = await global.com.task.insertMany(durls, { ordered: false }).catch(() => {});
      res && console.log(`${host}-search insert ${res.insertedCount} from ${durls.length} tasks`);

      return 1;
    } catch (err) {
      console.error(`${host}-search parse ${page.url} ${err}`);
      return 0;
    }
  },

  suggest: async (page) => {
    const host = URL.parse(page.url).hostname;
    const tasks = [];
    const companies = [];
    try {
      const con = page.con.toString('utf-8');
      const data = json(con);
      for (const item of data) {
        const id = item.overviewUrl.replace('/cmp/', '');
        const cmpurl = `https://www.indeed.com/cmp/${id}`;
        const joburl = `https://www.indeed.com/cmp/${id}/jobs?clearPrefilter=1`;
        tasks.push({ _id: md5(cmpurl), type: 'company', host, url: cmpurl, done: 0 });
        tasks.push({ _id: md5(joburl), type: 'jobs', host, url: joburl, done: 0 });
        companies.push({ _id: id, name: item.name, url: cmpurl });
      }

      let res = await global.com.company.insertMany(companies, { ordered: false }).catch(() => {});
      res && console.log(`${host}-suggest insert ${res.insertedCount} from ${companies.length} companies`);

      res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
      res && console.log(`${host}-suggest insert ${res.insertedCount} from ${tasks.length} tasks`);
      return 1;
    } catch (err) {
      console.error(`${host}-suggest parse ${page.url} ${err}`);
      return 0;
    }
  },

  // list: () => {},

  jobs: async (page) => {
    const host = URL.parse(page.url).hostname;
    const tasks = [];
    const durls = [];
    try {
      const con = iconv.decode(page.con, 'utf-8');
      const tmp = con.match(/window._initialData=(?<text>.*);<\/script><script>window._sentryData/u);
      let data;
      if (tmp) {
        const { text } = tmp.groups;
        data = json(text);
        if (data.jobList && data.jobList.pagination && data.jobList.pagination.paginationLinks) {
          for (const item of data.jobList.pagination.paginationLinks) {
            // eslint-disable-next-line max-depth
            if (item.href) {
              item.href = item.href.replace(/\u002F/g, '/');
              const url = URL.resolve(page.url, decodeURI(item.href));
              tasks.push({ _id: md5(url), type: 'jobs', host, url: decodeURI(url), done: 0 });
            }
          }
        }
        if (data.jobList && data.jobList.jobs) {
          for (const job of data.jobList.jobs) {
            const burl = `https://www.indeed.com/viewjob?jk=${job.jobKey}&from=vjs&vjs=1`;
            const durl = `https://www.indeed.com/rpc/jobdescs?jks=${job.jobKey}`;
            tasks.push({ _id: md5(burl), type: 'brief', host, url: burl, done: 0 });
            durls.push({ _id: md5(durl), type: 'detail', host, url: durl, done: 0 });
          }
        }
      } else {
        console.log(`${host}-jobs ${page.url} has no _initialData`);
      }
      let res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
      res && console.log(`${host}-search insert ${res.insertedCount} from ${tasks.length} tasks`);

      res = await global.com.task.insertMany(durls, { ordered: false }).catch(() => {});
      res && console.log(`${host}-search insert ${res.insertedCount} from ${durls.length} tasks`);

      return 1;
    } catch (err) {
      console.error(`${host}-jobs parse ${page.url} ${err}`);
      return 0;
    }
  },

  brief: async (page) => {
    const host = URL.parse(page.url).hostname;
    try {
      const con = page.con.toString('utf-8');
      const data = json(con);
      data.done = 0;
      data.views = 0;
      data.host = host;
      // format publish date
      if (data.vfvm && data.vfvm.jobAgeRelative) {
        const str = data.vfvm.jobAgeRelative;
        const tmp = str.split(' ');
        const [first, second] = tmp;
        if (first == 'Just' || first == 'Today') {
          data.publishDate = Date.now();
        } else {
          const num = first.replace(/\+/, '');
          if (second == 'hours') {
            const date = new Date();
            const time = date.getTime();
            // eslint-disable-next-line no-mixed-operators
            date.setTime(time - num * 60 * 60 * 1000);
            data.publishDate = date.getTime();
          } else if (second == 'days') {
            const date = new Date();
            const time = date.getTime();
            // eslint-disable-next-line no-mixed-operators
            date.setTime(time - num * 24 * 60 * 60 * 1000);
            data.publishDate = date.getTime();
          } else {
            data.publishDate = Date.now();
          }
        }
      }
      await global.com.job.updateOne({ _id: data.jobKey }, { $set: data }, { upsert: true }).catch(() => { });

      const tasks = [];
      const url = `https://www.indeed.com/jobs?l=${data.jobLocationModel.jobLocation}&sort=date`;
      tasks.push({ _id: md5(url), type: 'search', host, url, done: 0 });
      const res = await global.com.task.insertMany(tasks, { ordered: false }).catch(() => {});
      res && console.log(`${host}-brief insert ${res.insertedCount} from ${tasks.length} tasks`);
      return 1;
    } catch (err) {
      console.error(`${host}-brief parse ${page.url} ${err}`);
      return 0;
    }
  },

  detail: async (page) => {
    const host = URL.parse(page.url).hostname;
    try {
      const con = page.con.toString('utf-8');
      const data = json(con);
      const [jobKey] = Object.keys(data);
      await global.com.job.updateOne({ _id: jobKey }, { $set: { content: data[jobKey], done: 1 } }).catch(() => { });
      return 1;
    } catch (err) {
      console.error(`${host}-detail parse ${page.url} ${err}`);
      return 0;
    }
  },

  run: (page) => {
    if (page.type == 'list') {
      page.type = 'search';
    }
    const fn = fns[page.type];
    if (fn) {
      return fn(page);
    }
    console.error(`${page.url} parser not found`);
    return 0;
  }

};

module.exports = fns;