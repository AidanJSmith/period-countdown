import Vue from 'vue';
import Router from 'vue-router';
import Settings from './views/Settings.vue';
import Profile from './views/Profile.vue';
import Logout from './views/Logout.vue';

Vue.use(Router);

let router = new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      redirect: '/settings'
    },
    {
      path: '/settings',
      name: 'settings',
      component: Settings,
      meta: {
        title: 'settings — periods.io'
      }
    },
    {
      path: '/profile',
      name: 'profile',
      component: Profile
    },
    {
      path: '/logout',
      name: 'logout',
      component: Logout,
      meta: {
        title: 'logout — periods.io'
      }
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
});

router.beforeEach((to, from, next) => {
  if (to.meta.title) window.document.title = to.meta.title;
  next();
});

export default router;