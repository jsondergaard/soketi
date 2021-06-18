import { assert } from 'console';
import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(2);

describe('ws test', () => {
    afterEach(done => {
        Utils.flushServers().then(() => done());
    });

    test('client events', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'client-greeting' && channel === channelName) {
                        expect(data.message).toBe('hello');
                        done();
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel();

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.trigger('client-greeting', {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    test('client events dont get emitted when client messaging is disabled', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': false }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'client-greeting' && channel === channelName) {
                        throw new Error('The message was actually sent.');
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel({});

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.bind('pusher:error', (error) => {
                                expect(error.code).toBe(4301);
                                done();
                            });

                            channel.trigger('client-greeting', {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    test('client events dont get emitted when event name is big', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true, 'eventLimits.maxNameLength': 25 }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;
            let eventName = 'client-a8hsuNFXUhfStiWE02R'; // 26 characters

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === eventName && channel === channelName) {
                        throw new Error('The message was actually sent.');
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel({});

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.bind('pusher:error', (error) => {
                                expect(error.code).toBe(4301);
                                done();
                            });

                            channel.trigger(eventName, {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    test('client events dont get emitted when event payload is big', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true, 'eventLimits.maxPayloadInKb': 1/1024/1024 }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'client-greeting' && channel === channelName) {
                        throw new Error('The message was actually sent.');
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel({});

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.bind('pusher:error', (error) => {
                                expect(error.code).toBe(4301);
                                done();
                            });

                            channel.trigger('client-greeting', {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    test('cannot connect using invalid app key', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient({}, 6001, 'invalid-key', false);

            client.connection.bind('state_change', ({ current }) => {
                if (current === 'unavailable' || current === 'failed') {
                    done();
                }
            });
        });
    });

    test('throw over quota error if reached connection limit', done => {
        Utils.newServer({ 'appManager.array.apps.0.maxConnections': 1 }, (server: Server) => {
            let client1 = Utils.newClient({}, 6001, 'app-key', false);

            client1.connection.bind('connected', () => {
                let client2 = Utils.newClient({}, 6001, 'app-key', false);

                client2.connection.bind('state_change', ({ current }) => {
                    if (current === 'unavailable' || current === 'failed') {
                        done();
                    }
                });
            });
        });
    });

    test('should check for channelLimits.maxNameLength', done => {
        Utils.newServer({ 'channelLimits.maxNameLength': 25 }, (server: Server) => {
            let client = Utils.newClient();

            client.connection.bind('connected', () => {
                let channelName = 'a8hsuNFXUhfS1zoyvtDtiWE02Ra'; // 26 characters

                client.subscribe(channelName);

                client.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'pusher:subscription_error' && channel === channelName) {
                        expect(data.type).toBe('LimitReached');
                        expect(data.status).toBe(4009);
                        expect(data.error).toBeDefined();
                        done();
                    }
                });
            });
        });
    });

    test('should check for presence.maxMemberSizeInKb', done => {
        Utils.newServer({ 'presence.maxMemberSizeInKb': 1/1024/1024 }, (server: Server) => {
            let user = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let client = Utils.newClientForPresenceUser(user);
            let channelName = `presence-${Utils.randomChannelName()}`;

            client.connection.bind('connected', () => {
                client.subscribe(channelName);

                client.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'pusher:subscription_error' && channel === channelName) {
                        expect(data.type).toBe('LimitReached');
                        expect(data.status).toBe(4301);
                        expect(data.error).toBeDefined();
                        done();
                    }
                });
            });
        });
    });

    test('should check for presence.maxMembersPerChannel', done => {
        Utils.newServer({ 'presence.maxMembersPerChannel': 1 }, (server: Server) => {
            let user1 = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let user2 = {
                user_id: 2,
                user_info: {
                    id: 2,
                    name: 'Alice',
                },
            };

            let client1 = Utils.newClientForPresenceUser(user1);
            let channelName = `presence-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let channel1 = client1.subscribe(channelName);

                channel1.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPresenceUser(user2);

                    client2.connection.bind('message', ({ event, channel, data }) => {
                        if (event === 'pusher:subscription_error' && channel === channelName) {
                            expect(data.type).toBe('LimitReached');
                            expect(data.status).toBe(4100);
                            expect(data.error).toBeDefined();
                            done();
                        }
                    });

                    client2.subscribe(channelName);
                });
            });
        });
    });
});
