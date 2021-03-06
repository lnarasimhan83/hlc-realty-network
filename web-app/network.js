const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');

// declare namespace
const namespace = 'org.realty.biznet';

// in-memory card store for testing so cards are not persisted to the file system
const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );

// admin connection to the blockchain, used to deploy business network
let adminConnection;

// business network connection for the tests to use
let bNC;

let businessNetworkName = 'reatly-network';
let factory;

/*
 * Import card for an identity
 * @param {String} cardName The card name to use for this identity
 * @param {Object} identity The identity details
 */
async function importCardForIdentity(cardName, identity) {

    //use admin connection
    adminConnection = new AdminConnection();
    businessNetworkName = 'realty-network';

    //declare metadata
    const metadata = {
        userName: identity.userID,
        version: 1,
        enrollmentSecret: identity.userSecret,
        businessNetwork: businessNetworkName
    };

    //get connectionProfile from json, create Idcard
    const connectionProfile = require('./local_connection.json');
    const card = new IdCard(metadata, connectionProfile);

    //import card
    await adminConnection.importCard(cardName, card);
  }


/**
  * Reconnect using a different identity
  * @param {String} cardName The identity to use
  */
async function useIdentity(cardName) {

    //disconnect existing connection
    await bNC.disconnect();

    //connect to network using cardName
    bNC = new BusinessNetworkConnection();
    await bNC.connect(cardName);
}

// function to generate a random unique id
function uuid() {
    var uuid = "", i, random;
    for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i == 8 || i == 12 || i == 16 || i == 20) { uuid += "-" };
        uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
    }
    return uuid;
}

// export modules
module.exports = {

    /**
     * Create Builder and import card for identity
     * @param {String} cardId Import card for identity
     * @param {String} email
     * @param {String} name
     */
    registerBuilder: async (cardId, email, name) => {
        try {
            // connect as admin
            bNC = new BusinessNetworkConnection();
            await bNC.connect('admin@realty-network');

            // get factory for the business network
            factory = bNC.getBusinessNetwork().getFactory();

            // create builder
            const builder = factory.newResource(namespace, 'Builder', email);
            builder.email = email;
            builder.name = name;

            // add builder
            const participantRegistry = await bNC.getParticipantRegistry(namespace + '.Builder');
            await participantRegistry.add(builder);

            // issue identity
            const identity = await bNC.issueIdentity(namespace + '.Builder#' + email, cardId);

            // import card for identity
            await importCardForIdentity(cardId, identity);

            // disconnect
            await bNC.disconnect('admin@reatly-network');

            return true;
        }
        catch(err) {
            console.log(err);
            var error = {};
            error.error = err.message;
            return error;
        }
    },

    /**
     * Create Agent and import card for identity
     * @param {String} cardId Import card for identity
     * @param {String} email
     * @param {String} name
     * @param {String} service
     */
    registerAgent: async (cardId, email, name, service) => {
        try {
            // connect as admin
            bNC = new BusinessNetworkConnection();
            await bNC.connect('admin@realty-network');

            // get factory for the business network
            factory = bNC.getBusinessNetwork().getFactory();

            // create agent
            const agent = factory.newResource(namespace, 'Agent', email);
            agent.email = email;
            agent.name = name;
            agent.service = service;

            // add agent
            const participantRegistry = await bNC.getParticipantRegistry(namespace + '.Agent');
            await participantRegistry.add(agent);

            // issue identity
            const identity = await bNC.issueIdentity(namespace + '.Agent#' + email, cardId);

            // import card for identity
            await importCardForIdentity(cardId, identity);

            // disconnect
            await bNC.disconnect('admin@reatly-network');

            return true;
        }
        catch(err) {
            console.log(err);
            var error = {};
            error.error = err.message;
            return error;
        }
    },

    /**
     * Fetch the builder's data from the registry
     * @param {String} cardId
     * @param {String} email
     */
    getBuilderData: async (cardId, email) => {
        try {
            // connect to the business network
            bNC = new BusinessNetworkConnection();
            await bNC.connect(cardId);

            // get the builder's details
            const builderRegistry = await bNC.getParticipantRegistry(namespace + '.Builder');
            const builder = await builderRegistry.get(email);

            /* get the project details that are linked to this builder.
             * easiest way I can think of is to fetch all the projects and then select only those that are 
             * linked to this builder.
             */
            const projectRegistry = await bNC.getAssetRegistry(namespace + '.Project');
            const projectList = await projectRegistry.getAll();
            console.log(`The current projects are: ${JSON.stringify(projectList)}`);
            let projects = [];
            console.log(`projects are ${projects}`)
            projectList.forEach(project => {
                if (project.builder.email == email) {
                    projects.append(project);
                }
            });
            // let response = {
            //     email: builder.email,
            //     name: builder.name,
            //     //projectList: projects
            // }
            // console.log(`response data for ${builder} is: ${builder.email} and ${builder.name}`);
            return builder;
        }
        catch(err) {
            console.log(err);
            var error = {};
            error.error = err.message;
            return error;
        }
    },

    /**
     * Create Agent and import card for identity
     * @param {String} cardId Import card for identity
     * @param {String} email
     * @param {String} name
     * @param {String} service
     */
    createProject: async (name, builderEmail) => {
        try {
            // connect as admin
            bNC = new BusinessNetworkConnection();
            await bNC.connect('admin@realty-network');

            // get factory for the business network
            factory = bNC.getBusinessNetwork().getFactory();

            // create project
            let projectId = uuid();
            const project = factory.newResource(namespace, 'Project', projectId);
            project.id = projectId;
            project.name = name;
            project.builder = factory.newRelationship(namespace, 'Builder', builderEmail);
            project.service = '';
            project.status = '';
            project.agentName = '';

            // add project to registry
            const assetRegistry = await bNC.getAssetRegistry(namespace + '.Project');
            await assetRegistry.add(project);

            // disconnect
            await bNC.disconnect('admin@realty-network');

            return true;
        }
        catch(err) {
            console.log(err);
            var error = {};
            error.error = err.message;
            return error;
        }
    },

    /**
     * Initiate service request
     * @param {String} cardId Import card for identity
     * @param {String} serviceType
     * @param {String} status
     * @param {String} projectId
     * @param {String} agentEmail
     */
    initiateService: async (cardId, serviceType, status, projectId, agentEmail) => {
      try {
        //connect to network with cardId
        bNC = new BusinessNetworkConnection();
        await bNC.connect(cardId);

        //get the factory for the business network.
        factory = bNC.getBusinessNetwork().getFactory();

        //create transaction
        const serviceReq = factory.newTransaction(namespace, 'ServiceUpdate');
        serviceReq.service = serviceType;
        serviceReq.status = status;
        serviceReq.project = factory.newRelationship(namespace, 'Project', projectId);
        serviceReq.agent = factory.newRelationship(namespace, 'Agent', agentEmail);

        //submit transaction
        await bNC.submitTransaction(serviceReq);

        //disconnect
        await bNC.disconnect(cardId);
        return true;

      } catch (err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
    }


}
