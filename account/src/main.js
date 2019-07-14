import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import VueAnalytics from 'vue-analytics';
import { accountVersion } from '../../common';
import '@/assets/global.css';

Vue.config.productionTip = false;

Vue.use(VueAnalytics, {
  id: 'UA-143817963-1',
  router,
  set: [
    {
      field: 'appVersion',
      value: accountVersion
    }
  ],
  autoTracking: {
    exception: true
  },
  debug: {
    enabled: false,
    sendHitTask: process.env.NODE_ENV === 'production'
  }
});

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app');

