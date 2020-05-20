const PocketJS = require('@pokt-network/pocket-js');
const Pocket = PocketJS.Pocket;
const Configuration = PocketJS.Configuration;
const Provider = PocketJS.HttpRpcProvider;
const PocketAAT = PocketJS.PocketAAT;
const EthereumTx = require('ethereumjs-tx').Transaction;

// point to a dispatcher 
const dispatchers = [new URL("http://node3.testnet.pokt.network:8081")];

/*
(optional)Configuration stores multiple properties used to interact with the Pocket Network. 
   - maxDispatchers - (optional) Maximun amount of dispatchers urls to stored in rounting table, default 0.
   - maxSessions - (optional) Maximun amount of sessions to stored for the session manager, default 0.
   - maxConsensusNodes - (optional) Maximun amount of nodes for local consensus, mandatory ODD number, default 0.
   - requestTimeOut - (optional) Maximun timeout for every request in miliseconds, default 0.
   - acceptDisputedResponses - (optional) Accept or reject responses based on having a full consensus, default false.
   - 
*/
const configuration = new Configuration(5, 1000, 5, 4000,true);

// create RPC provider
const rpcProvider = new Provider(dispatchers)

/* required if you are not using the AAT-SDK to secure your staked account
   - appPubKeyHex: the public key of your staked account
   - appPrivKeyHex: the private key of your staked account
   - passphrase: a pasphrase to encrypt your account locally. 
*/
const appPubKeyHex = "6d8ebc6957179fbc27c564612f823016030cd302550b4c21af2d5e38273ef5c1"
const appPrivKeyHex = "802c280243cdf69e729f15778a87a6ee10b001027db093b70112c70d429d3a196d8ebc6957179fbc27c564612f823016030cd302550b4c21af2d5e38273ef5c1"
const passphrase = "pocket"; //change

// The blockchain hash needed to identify the blockchain you wish to connect to. See Supported Networks(https://docs.pokt.network/v2.1/docs/supported-networks) 
const blockchain = "0022";

/*
 create a pocket instance and stores muliple configuration options for your node
	- dispatchers: Array holding the initial dispatcher url(s).
  - rpcProvider:(optional) Provider which will be used to reach out to the Pocket Core RPC interface.
  - configuration:(optional) configuration object
  - store: (optional)Save data using a Key/Value relationship. This object save information in memory.
*/
const pocket = new Pocket(dispatchers,rpcProvider,configuration);

// (optional) if you want to send ETH tokens you will have to create a transaction signer
const transactionSigner = {
    // Needs at least 2 accounts in the node to run all tests
    accounts: ["0x2a14d313f58ba0bd4e8fa282082d11da24b1daa3".toLowerCase(), "0xF0BE394Fb2Def90824D11C7Ea189E75a8e868fA6".toLowerCase()],
    /*
     Callback method called to determine wether or not the
     TransactionSigner supports signing transactions for the given addr         */
    hasAddress: async function (address) {
        return transactionSigner.accounts.includes(address.toLowerCase())
    },
    // Update this object with the address - private keys for each account in the same order they are declared
    privateKeys: ["F3D7A8A15A23E2689511A7505D389960D007925119DEC14892466F0EDB0876B8"],
    /*
    Callback method called to generate a serialized signed format
    of the given a Web3.js transaction object 
    (https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sendtransaction)
    */
    signTransaction: async function (txParams) {
        try {
            //const pkString = ethTransactionSigner.privateKeys[0]
            const privateKeyBuffer = Buffer.from("F3D7A8A15A23E2689511A7505D389960D007925119DEC14892466F0EDB0876B8", 'hex')
            const tx = new EthereumTx(txParams, {
                chain: 'rinkeby'
            })
            tx.sign(privateKeyBuffer)
            return '0x' + tx.serialize().toString('hex')
        } catch (error) {
            console.error(error)
            return error
        }
    }
}

async function sendRelay() {

    /*
    create a client account that will be used to relay requests on the application account behalf. All you will need is: 
        - clientAccount: a client account that will request relays on behalf of the application account
        - passphrase: a passphrase that will be used to encrypt the account
    
    */
    const clientPassphrase = "1234";
    const clientAccount = await pocket.keybase.createAccount(clientPassphrase);
    
    

    // import application acct that is staked on the pocket blockchain
    const importacct = await pocket.keybase.importAccount(appPrivKeyHex,passphrase);

        /*
    Unlock client account with:
    - addressHex: address of the account that will be unlocked in hex string format
    - passphrase: passphrase of the account to unlock
    - unlockPeriod: The amount of time (in ms) the account is going to be unlocked
    */
    const unlockAcct =  await pocket.keybase.unlockAccount(clientAccount.addressHex,clientPassphrase,0);

    //(optional) test to see if the client account has been sucessfully unlocked. It will return: True or False 
    const isUnlocked = await pocket.keybase.isUnlocked(clientAccount.addressHex);
    //console.log(isUnlocked);

    /*
    Create AAT Token with the following arguments:
    - version: Version information
    - clientPublicKey:Client Public Key
    - applicationPublicKey: Application Public Key
    - privateKey: Application Private Key
    */
    const pocketAAT = await PocketAAT.from("0.0.1", clientAccount.publicKey.toString("hex"),appPubKeyHex,appPrivKeyHex);

    //(optional) create a tx param if you wish to send tokens 
    const tx = {
        "gas": "0x5208", //need to specify gas
        "chainId": 4, // rinkeby chainID
        "nonce": 50,
        "from": "0x2a14d313f58ba0bd4e8fa282082d11da24b1daa3",
        "to": "0xF0BE394Fb2Def90824D11C7Ea189E75a8e868fA6",
        "value": '0x2710' // Change value for the amount being sent
    }

    //Create the payload for the transaction  
    var payload = {
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": ["0x2a14D313F58bA0bd4e8Fa282082D11DA24b1DaA3", "latest"],
        "id": (new Date()).getTime()
    }

    //(optional) sign the transaction usign the transaction signer and generate the tx hash
    const ethSign = await transactionSigner.signTransaction(tx);
    const txHash = (ethSign.toString('hex'));

     // to query the a balance in a relay 
     const queryRelay = await pocket.sendRelay(JSON.stringify(payload),blockchain,pocketAAT)

    
    try {
        const ethRelayData = '{\"jsonrpc\":\"2.0\",\"method\":\"eth_sendRawTransaction\",\"params\":["0xf861328082520894f0be394fb2def90824d11c7ea189e75a8e868fa6822710802ca05baeac4f6e701e488c4de40d5764bcc1212e2fc559aab1e1a190e56678ce14e1a0272e4e95a669c70244e339c012e858d578658a264060968f713c82ba59943f66"],\"id\":67}'
        
        //to send tokens in a relay
        const ethRelayResponse = await pocket.sendRelay(relayResponse,blockchain,pocketAAT);
        
       
        // only return the payload w/ the result
        const parsedPayload = JSON.parse(queryRelay.payload);
  
        console.log(parsedPayload);

    }catch (err){
        Error.message
    }

   
}

sendRelay()
