/// <reference path="../../manual_typings/manual_typings.d.ts" />

import {
  expect,
  ddescribe,
  describe,
  it,
  iit,
  beforeEach
} from '@angular/core/testing';
import {ReflectiveInjector, provide, Provider} from '@angular/core';
import {Observable} from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer';
import {
  defaultFirebase,
  FIREBASE_PROVIDERS,
  FirebaseApp,
  FirebaseConfig,
  AngularFireAuth,
  AuthMethods,
  firebaseAuthConfig,
  AuthProviders
} from '../angularfire2';
import {
  firebaseConfig
} from '../angularfire2.spec';
import {AuthBackend, FirebaseAuthState} from './auth_backend';
import {FirebaseSdkAuthBackend} from './firebase_sdk_auth_backend';
import { auth } from 'firebase';

// Set providers from firebase so no firebase.auth.GoogleProvider() necessary
const {
  GoogleAuthProvider,
  TwitterAuthProvider,
  GithubAuthProvider
} = auth;

const authMethods = ['signInWithCustomToken', 'signInAnonymously', 'signInWithEmailAndPassword',
  'signInWithPopup', 'signInWithRedirect', 'signInWithCredential',
  'signOut', 'onAuthStateChanged',
  'createUserWithEmailAndPassword', 'changeEmail', 'removeUser', 'resetPassword'
];

const providerMetadata = {
  accessToken: 'accessToken',
  displayName: 'github User',
  username: 'githubUsername',
  id: '12345',
  expires: 0
}

const authObj = {
  token: 'key'
}

const firebaseUser = <firebase.User> {
  uid: '12345',
  providerData: [{
    'displayName': 'jeffbcross',
    providerId: 'github.com'
  }]
};

const githubCredential = {
  credential: {
    accessToken: 'ACCESS_TOKEN',
    providerId: 'github.com'
  },
  user: firebaseUser
};

const googleCredential = {
  credential: {
  },
  user: firebaseUser
}

const AngularFireAuthState = <FirebaseAuthState>{
  provider: 0,
  auth: firebaseUser,
  // photoURL: '',
  // providerId: 'github.com',
  // providerData: [],
  // displayName: '',
  // email: '',
  uid: '12345',
  // refreshToken: '',
  github: {
    accessToken: 'GH_ACCESS_TOKEN',
    provider: 'github.com'
  }
};

describe('FirebaseAuth', () => {
  let injector: ReflectiveInjector;
  let app: firebase.app.App;
  let authData: any;
  let authCb: any;
  let backend: AuthBackend;

  beforeEach(() => {
    authData = null;
    authCb = null;
    injector = ReflectiveInjector.resolveAndCreate([
      FIREBASE_PROVIDERS,
      defaultFirebase(firebaseConfig)
    ]);
    app = injector.get(FirebaseApp);
  });

  afterEach(done => {
    app.delete().then(done, done.fail);
  });


  it('should be an observable', () => {
    expect(injector.get(AngularFireAuth)).toBeAnInstanceOf(Observable);
  });


  it('should emit auth updates', (done: any) => {
    var fbAuthObserver: Observer<firebase.User>;
    let count = 0;
    let fbAuthSpy = jasmine.createSpyObj('auth', authMethods);
    fbAuthSpy.onAuthStateChanged.and
      .callFake((obs: Observer<firebase.User>) => {
        fbAuthObserver = obs;
      });
    app.auth = () => fbAuthSpy;
    let afAuth = injector.get(AngularFireAuth);
    fbAuthObserver.next(null);
    afAuth
      .do(() => count++)
      .subscribe(authData => {
        switch (count) {
          case 1:
            expect(authData).toBe(null);
            // Not sure why this has to be wrapped in a setTimeout
            setTimeout(() => fbAuthObserver.next(firebaseUser));
            break;
          case 2:
            expect(authData.auth).toEqual(AngularFireAuthState.auth);
            done();
            break;
          default:
            throw new Error('Called too many times');
        }
      }, done.fail);
  }, 10);

  describe('AuthState', () => {

    beforeEach(() => {
      spyOn(app.auth(), 'onAuthStateChanged').and.callFake((fn: Function | Observer<firebase.User>) => {
        authCb = fn;
        if (typeof authCb === 'function') {
          authCb(authData);
        } else if (authCb && typeof authCb === 'object') {
          <Observer<firebase.User>>authCb.next(authData);
        }
      });
      backend = new FirebaseSdkAuthBackend(app);
    });

    function updateAuthState(_authData: any): void {
      authData = _authData;

      if (typeof authCb === 'function') {
        authCb(authData);
      } else if (authCb && typeof authCb === 'object') {
        <Observer<firebase.User>>authCb.next(authData);
      }
    }

    it('should asynchronously load firebase auth data', (done) => {
      updateAuthState(firebaseUser);
      let afAuth = injector.get(AngularFireAuth);

      afAuth
        .take(1)
        .subscribe((data) => {
          expect(data.auth).toEqual(AngularFireAuthState.auth);
          done();
        }, done.fail);
    });

    it('should be null if user is not authed', (done) => {
      let afAuth = injector.get(AngularFireAuth);

      afAuth
        .take(1)
        .subscribe(authData => {
          expect(authData).toBe(null);
          done();
        }, done.fail);
    });
  });


  describe('firebaseAuthConfig', () => {
    beforeEach(() => {
      var authSpy = jasmine.createSpyObj('auth', authMethods);
      (<jasmine.Spy>authSpy.signInWithPopup).and.returnValue(Promise.resolve(googleCredential));
      (<jasmine.Spy>authSpy.signInWithCredential).and.returnValue(Promise.resolve(firebaseUser));
      (<jasmine.Spy>authSpy.signInAnonymously).and.returnValue(Promise.resolve(firebaseUser));
      app.auth = () => authSpy;
      backend = new FirebaseSdkAuthBackend(app);
    });

    it('should return a provider', () => {
      expect(firebaseAuthConfig({ method: AuthMethods.Password })).toBeAnInstanceOf(Provider);
    });

    it('should use config in login', () => {
      let config = {
        method: AuthMethods.Anonymous
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login();
      expect(app.auth().signInAnonymously).toHaveBeenCalled();
    });

    it('should be overridden by login\'s arguments', () => {
      let config = {
        method: AuthMethods.Anonymous
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login({
        method: AuthMethods.Popup,
        provider: AuthProviders.Google
      });
      var spyArgs = (<jasmine.Spy>app.auth().signInWithPopup).calls.argsFor(0)[0];
      var googleProvider = new GoogleAuthProvider();
      expect(app.auth().signInWithPopup).toHaveBeenCalledWith(googleProvider);
    });

    it('should be merged with login\'s arguments', () => {
      let config = {
        method: AuthMethods.Popup,
        provider: AuthProviders.Google,
        scope: ['email']
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login({
        provider: AuthProviders.Github
      });
      var githubProvider = new GithubAuthProvider();
      githubProvider.addScope('email');
      expect(app.auth().signInWithPopup).toHaveBeenCalledWith(githubProvider);
    });
  });

  describe('createUser', () => {
    let afAuth: AngularFireAuth;
    let credentials = { email: 'noreply@github.com', password: 'password' };

    beforeEach(() => {
      var authSpy = jasmine.createSpyObj('auth', authMethods);
      app.auth = () => authSpy;
      backend = new FirebaseSdkAuthBackend(app);
      afAuth = new AngularFireAuth(backend);
      (<jasmine.Spy>authSpy.createUserWithEmailAndPassword).and.returnValue(Promise.resolve(firebaseUser));
    });

    it('should call createUser on the app reference', () => {
      afAuth.createUser(credentials);
      expect(app.auth().createUserWithEmailAndPassword)
        .toHaveBeenCalledWith(credentials.email, credentials.password);
    });
  });

  describe('login', () => {
    let afAuth: AngularFireAuth = null;
    var authSpy;

    beforeEach(() => {
      authSpy = jasmine.createSpyObj('auth', authMethods);
      app.auth = () => authSpy;
      backend = new FirebaseSdkAuthBackend(app);
      afAuth = new AngularFireAuth(backend);
    });

    it('should reject if password is used without credentials', (done: any) => {
      let config = {
        method: AuthMethods.Password
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login().then(done.fail, done);
    });

    it('should reject if custom token is used without credentials', (done: any) => {
      let config = {
        method: AuthMethods.CustomToken
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login().then(done.fail, done);;
    });

    it('should reject if oauth token is used without credentials', (done: any) => {
      let config = {
        method: AuthMethods.OAuthToken
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login().then(done.fail, done);
    });

    it('should reject if popup is used without a provider', (done: any) => {
      let config = {
        method: AuthMethods.Popup
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login().then(done.fail, done);
    });

    it('should reject if redirect is used without a provider', (done: any) => {
      let config = {
        method: AuthMethods.Redirect
      };
      let afAuth = new AngularFireAuth(backend, config);
      afAuth.login().then(done.fail, done);
    });

    describe('authWithCustomToken', () => {
      let options = {
        method: AuthMethods.CustomToken
      };
      let credentials = {
        token: 'myToken'
      };

      beforeEach(() => {
        (<jasmine.Spy>authSpy.signInWithCustomToken).and.returnValue(Promise.resolve(firebaseUser));
      })

      it('passes custom token to underlying method', () => {
        afAuth.login(credentials, options);
        expect(app.auth().signInWithCustomToken)
          .toHaveBeenCalledWith('myToken');
      });

      it('will reject the promise if authentication fails', (done: any) => {
        authSpy.signInWithCustomToken = jasmine.createSpy('signInWithCustomToken').and.returnValue(Promise.reject('error'));
        afAuth.login(credentials, options).then(done.fail, done);
      });

      it('will resolve the promise upon authentication', (done: any) => {
        afAuth.login(credentials, options).then(result => {
          expect(result.auth).toEqual(AngularFireAuthState.auth);
          done();
        }, done.fail);
      });
    });

    describe('authAnonymously', () => {
      let options = {
        method: AuthMethods.Anonymous
      };

      beforeEach(() => {
        (<jasmine.Spy>authSpy.signInAnonymously).and.returnValue(Promise.resolve(firebaseUser));
      });

      it('passes options object to underlying method', () => {
        afAuth.login(options);
        expect(app.auth().signInAnonymously).toHaveBeenCalled();
      });

      it('will reject the promise if authentication fails', (done: any) => {
        authSpy.signInAnonymously = jasmine.createSpy('signInAnonymously').and.returnValue(Promise.reject('myError'));
        afAuth.login(options).then(done.fail, done);
      });

      it('will resolve the promise upon authentication', (done: any) => {
        afAuth.login(options).then(result => {
          expect(result.auth).toEqual(AngularFireAuthState.auth);
          done();
        }, done.fail);
      });
    });

    describe('authWithPassword', () => {
      let options = { remember: 'default', method: AuthMethods.Password };
      let credentials = { email: 'myname', password: 'password' };

      beforeEach(() => {
        (<jasmine.Spy>authSpy.signInWithEmailAndPassword).and.returnValue(Promise.resolve(firebaseUser));
      });

      it('should login with password credentials', () => {
        let config = {
          method: AuthMethods.Password,
          provider: AuthProviders.Password
        };
        const credentials = {
          email: 'david@fire.com',
          password: 'supersecretpassword'
        };
        let afAuth = new AngularFireAuth(backend, config);
        afAuth.login(credentials);
        expect(app.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(credentials.email, credentials.password);
      });

      it('passes options and credentials object to underlying method', () => {
        afAuth.login(credentials, options);
        expect(app.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(
          credentials.email,
          credentials.password);
      });

      it('will revoke the promise if authentication fails', (done: any) => {
        authSpy.signInWithEmailAndPassword = jasmine.createSpy('signInWithEmailAndPassword').and.returnValue(Promise.reject('myError'));
        afAuth.login(credentials, options).then(done.fail, done);
      });

      it('will resolve the promise upon authentication', (done: any) => {
        afAuth.login(credentials, options).then(result => {
          expect(result.auth).toEqual(AngularFireAuthState.auth);
          done();
        }, done.fail);
      });
    });

    describe('authWithOAuthPopup', function() {
      let options = {
        method: AuthMethods.Popup,
        provider: AuthProviders.Github
      };
      it('passes provider and options object to underlying method', () => {
        (<jasmine.Spy>authSpy.signInWithCredential).and.returnValue(Promise.resolve(firebaseUser));
        authSpy.signInWithPopup.and.returnValue(Promise.resolve(githubCredential));
        let customOptions = Object.assign({}, options);
        customOptions.scope = ['email'];
        afAuth.login(customOptions);
        let githubProvider = new GithubAuthProvider();
        githubProvider.addScope('email');
        expect(app.auth().signInWithPopup).toHaveBeenCalledWith(githubProvider);
      });

      it('will reject the promise if authentication fails', (done: any) => {
        authSpy.signInWithPopup.and.returnValue(Promise.reject('myError'));
        afAuth.login(options).then(done.fail, done);
      });

      it('will resolve the promise upon authentication', (done: any) => {
        authSpy.signInWithPopup.and.returnValue(Promise.resolve(githubCredential));
        afAuth.login(options).then(result => {
          expect(result.auth).toEqual(AngularFireAuthState.auth);
          done();
        }, done.fail);
      });
    });

    describe('authWithOAuthRedirect', () => {
      const options = {
        method: AuthMethods.Redirect,
        provider: AuthProviders.Github
      };
      it('passes provider and options object to underlying method', () => {
        let customOptions = Object.assign({}, options);
        customOptions.scope = ['email'];
        afAuth.login(customOptions);
        let githubProvider = new GithubAuthProvider();
        expect(app.auth().signInWithRedirect).toHaveBeenCalledWith(githubProvider);
      });

      it('will reject the promise if authentication fails', (done: any) => {
        authSpy.signInWithRedirect = jasmine.createSpy('signInWithRedirect').and.returnValue(Promise.reject('myError'));
        afAuth.login(options).then(done.fail, done);
      });

      it('will resolve the promise upon authentication', (done: any) => {
        authSpy.signInWithRedirect = jasmine.createSpy('signInWithRedirect').and.returnValue(Promise.resolve(AngularFireAuthState));
        afAuth.login(options).then(result => {
          expect(result).toEqual(AngularFireAuthState);
          done();
        }, done.fail);
      });
    });

    describe('authWithOAuthToken', () => {
      const options = {
        method: AuthMethods.OAuthToken,
        provider: AuthProviders.Github,
        scope: ['email']
      };
      const token = 'GITHUB_TOKEN';
      const credentials = GithubAuthProvider.credential(token);
      it('passes provider, token, and options object to underlying method', () => {
        (<jasmine.Spy>authSpy.signInWithCredential).and.returnValue(Promise.resolve(firebaseUser));
        afAuth.login(credentials, options);
        expect(app.auth().signInWithCredential).toHaveBeenCalledWith(credentials);
      });

      it('passes provider, OAuth credentials, and options object to underlying method', () => {
        (<jasmine.Spy>authSpy.signInWithCredential).and.returnValue(Promise.resolve(firebaseUser));
        let customOptions = Object.assign({}, options);
        customOptions.provider = AuthProviders.Twitter;
        let credentials = TwitterAuthProvider.credential('<ACCESS-TOKEN>', '<ACCESS-TOKEN-SECRET>');
        afAuth.login(credentials, customOptions);
        expect(app.auth().signInWithCredential).toHaveBeenCalledWith(credentials);
      });

      it('will reject the promise if authentication fails', (done: any) => {
        authSpy.signInWithCredential = jasmine.createSpy('signInWithCredential').and.returnValue(Promise.reject('myError'));
        afAuth.login(credentials, options).then(done.fail, done);
      });

      it('will resolve the promise upon authentication', (done: any) => {
        authSpy.signInWithCredential = jasmine.createSpy('signInWithCredential').and.returnValue(Promise.resolve(firebaseUser));
        afAuth.login(credentials, options).then(result => {
          expect(result.auth).toEqual(AngularFireAuthState.auth);
          done();
        }, done.fail);
      });
    });


    describe('unauth()', () => {
      it('will call unauth() on the backing ref', () => {
        afAuth.logout();
        expect(app.auth().signOut).toHaveBeenCalled();
      });
    });
  });
});

