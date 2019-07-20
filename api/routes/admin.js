const router = require('express').Router();
const responses = require('../lib/responses');

const admins = process.env.ADMIN_EMAILS.split(',');
let mysql;

router.all('*', async (req, res, next) => {
  try {
    let res = await mysql.query('SELECT registered_to FROM devices WHERE device_id = ?', [ req.device_id ]);

    if (admins.includes(res[0].registered_to)) {
      next();
    } else {
      throw 'Not admin';
    }
  } catch (e) {
    res.send(responses.error('admin_only'));
  }

});

async function colStats(table, col, from, to) {
  return (await mysql.query(
    `SELECT MAX(${col}) AS max, MIN(${col}) AS min, AVG(${col}) AS avg, STD(${col}) as std FROM ${table} WHERE time > ? AND time < ?`,
    [from, to]
  ))[0];
}

async function colPopular(table, col, limit, from, to) {
  return await mysql.query(
    `SELECT ${col} as value, COUNT(*) AS count FROM ${table} WHERE time > ? AND time < ? GROUP BY value ORDER BY count DESC LIMIT ${limit}`,
    [from, to]
  );
}

router.get('/bucket/:table', async (req, res) => {
  if (req.params.table !== 'hits' && req.params.table !== 'events') {
    return;
  }

  let table = req.params.table;
  let from = parseInt(req.query.from);
  let to = parseInt(req.query.to);
  let increments = parseInt(req.query.buckets);
  let incrementSize = Math.round((to - from) / increments);
  let data = {};

  let resp = await mysql.query(`SELECT time FROM ${table} WHERE time > ? AND time < ?`, [from, to]);
  resp = resp.map(a => a.time);

  let key = from;
  let nextKey = from + incrementSize;
  let i = 0;
  while (key <= to) {
    data[key] = 0;

    for (; i < resp.length; i++) {
      if (resp[i] >= nextKey)
        break;

      data[key]++;
    }

    key += incrementSize;
    nextKey += incrementSize;
  }

  res.send(responses.success(data));
});

router.get('/analytics', async (req, res) => {
  let from = parseInt(req.query.from);
  let to = parseInt(req.query.to);

  let data = {
    hits: {},
    devices: {},
    errors: {},
    events: {},
    users: {},
    totals: {
      devices: {}
    }
  }
  let resp;

  let start = Date.now();

  // hits
  resp = await mysql.query('SELECT COUNT(*) FROM hits WHERE time > ? AND time < ?', [from, to]);
  data.hits.count = resp[0]['COUNT(*)'];
  resp = await mysql.query(
    'SELECT COUNT(*) FROM hits WHERE time > ? AND time < ? AND device_id IN (SELECT device_id FROM devices WHERE registered_to IS NOT NULL)',
    [from, to]
  );
  data.hits.hits_from_users = resp[0]['COUNT(*)'];
  data.hits.version = await colPopular('hits', 'version', 10, from, to);
  data.hits.ip = await colPopular('hits', 'ip', 20, from, to);
  data.hits.pathname = await colPopular('hits', 'pathname', 10, from, to);
  data.hits.referrer = await colPopular('hits', 'referrer', 10, from, to);
  data.hits.school = await colPopular('hits', 'school', 20, from, to);
  data.hits.period = await colPopular('hits', 'period', 30, from, to);
  data.hits.user_theme = await colPopular('hits', 'user_theme', 10, from, to);
  data.hits.user_period = await colPopular('hits', 'user_period', 10, from, to);
  data.hits.dc = await colStats('hits', 'dc', from, to);
  data.hits.pc = await colStats('hits', 'pc', from, to);
  data.hits.rt = await colStats('hits', 'rt', from, to);
  data.hits.dns = await colStats('hits', 'dns', from, to);
  data.hits.tti = await colStats('hits', 'tti', from, to);
  data.hits.ttfb = await colStats('hits', 'ttfb', from, to);
  resp = await mysql.query(
    'SELECT COUNT(DISTINCT device_id) FROM hits WHERE time > ? AND time < ?',
    [from, to]
  );
  data.hits.unique_devices = resp[0]['COUNT(DISTINCT device_id)'];
  resp = await mysql.query(
    'SELECT * FROM users WHERE email IN (SELECT registered_to FROM devices WHERE device_id IN (SELECT device_id FROM hits WHERE time > ? AND time < ?))', [from, to]
  );
  data.hits.unique_users = resp;

  // devices
  resp = await mysql.query('SELECT COUNT(*) FROM devices WHERE time > ? AND time < ?', [from, to]);
  data.devices.count = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM devices WHERE time_registered > ? AND time_registered < ?', [from, to]);
  data.devices.count_registered = resp[0]['COUNT(*)'];

  // errors
  resp = await mysql.query('SELECT * FROM errors WHERE time > ? AND time < ?', [from, to]);
  data.errors = resp;

  // events
  resp = await mysql.query('SELECT COUNT(*) FROM events WHERE time > ? AND time < ?', [from, to]);
  data.events.count = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM events WHERE event = ? AND time > ? AND time < ?', ['upt_pref', from, to]);
  data.events.upt_pref = resp[0]['COUNT(*)'];
  
  // users
  resp = await mysql.query('SELECT * FROM users WHERE time > ? AND time < ?', [from, to]);
  data.users = resp;

  // totals
  resp = await mysql.query('SELECT COUNT(*) FROM hits');
  data.totals.hits = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM devices');
  data.totals.devices.count = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM devices WHERE registered_to IS NOT NULL');
  data.totals.devices.registered = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM errors');
  data.totals.errors = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM events');
  data.totals.events = resp[0]['COUNT(*)'];
  resp = await mysql.query('SELECT COUNT(*) FROM users');
  data.totals.users = resp[0]['COUNT(*)'];

  data.analysis_time = Date.now() - start;
  res.send(responses.success(data));
});

module.exports = a => {
  mysql = a;

  return router;
}