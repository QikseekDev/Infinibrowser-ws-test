import WebSocket from "ws";

const sessions = new Map();
const cache = new Map();


function createSession(key) {

    let session = {
        ws: null,
        nonce: 0,
        ready: false,
        verified: false,
        identified: false,
        pending: new Map(),
        internal_offset: 0,
        heartbeat: null
    };


    session.ws = new WebSocket(
        "wss://infinibrowser.wiki/api/ws",
        {
            headers: {
                Origin:
                    "https://infinibrowser.wiki",

                "User-Agent":
                    "Mozilla/5.0"
            }
        }
    );


    function send(op, data, nonce) {

        const msg = {
            op,
            nonce,
            data
        };

        console.log(
            "[SEND]",
            JSON.stringify(msg)
        );

        session.ws.send(
            JSON.stringify(msg)
        );
    }



    session.ws.on("open", () => {

        console.log(
            "[WS OPEN]"
        );


        send(
            "identify",
            {
                client:
                    "InfCraftBrowser/1.6",

                version:
                    2,

                token:
                    null
            }
        );


        session.heartbeat =
            setInterval(() => {

                if (
                    session.ws.readyState === WebSocket.OPEN
                ) {

                    send(
                        "heartbeat"
                    );

                }

            },30000);


    });



    session.ws.on("message", raw => {

        let msg;

        try {
            msg =
                JSON.parse(
                    raw.toString()
                );
        }

        catch {
            return;
        }


        console.log(
            "[RECV]",
            JSON.stringify(msg)
        );



        if (
            msg.op === "verify" &&
            msg.data?.token
        ) {

            send(
                "verify",
                {
                    token:
                        msg.data.token
                }
            );

            return;
        }



        if (
            msg.op === "verify" &&
            msg.data?.ok
        ) {

            session.verified = true;

        }



        if (
            msg.op === "identify"
        ) {

            session.identified = true;

        }



        if (
            msg.op === "search"
        ) {

            session.internal_offset =
                msg.data?.internal_offset ??
                session.internal_offset;


            const request =
                session.pending.get(
                    msg.nonce
                );


            if (request) {

                session.pending.delete(
                    msg.nonce
                );


                request.resolve(
                    msg.data
                );

            }

        }

    });



    session.ws.on("close", () => {

        console.log(
            "[WS CLOSED]"
        );


        clearInterval(
            session.heartbeat
        );


        sessions.delete(
            key
        );

    });



    session.ws.on("error", err => {

        console.log(
            "[WS ERROR]",
            err
        );

    });



    sessions.set(
        key,
        session
    );


    return session;

}



async function searchInfini(key, data) {

    let session =
        sessions.get(key);


    if (!session) {

        session =
            createSession(key);

    }



    while (
        !session.ready
    ) {

        if (
            session.verified &&
            session.identified
        ) {

            session.ready = true;
            break;

        }


        await new Promise(
            r => setTimeout(r,50)
        );

    }



    session.nonce++;


    const nonce =
        session.nonce;



    const payload = {

        offset:
            data.offset ?? 0,


        internal_offset:
            data.internal_offset ??
            session.internal_offset,


        query:
            data.query ?? "",


        sort:
            data.sort ?? "time",


        order:
            data.order ?? "ascending"

    };



    if (
        data.before !== undefined
    ) {

        payload.before =
            data.before;

    }



    return new Promise((resolve,reject)=>{


        const timer =
            setTimeout(()=>{

                session.pending.delete(
                    nonce
                );

                reject(
                    new Error(
                        "Infini timeout"
                    )
                );

            },20000);



        session.pending.set(
            nonce,
            {
                resolve(value){

                    clearTimeout(
                        timer
                    );

                    resolve(value);

                },

                reject
            }
        );



        sendSearch(
            session,
            payload,
            nonce
        );


    });

}



function sendSearch(session,payload,nonce){

    const msg = {

        op:
            "search",

        nonce,

        data:
            payload

    };


    console.log(
        "[SEARCH]",
        JSON.stringify(msg)
    );


    session.ws.send(
        JSON.stringify(msg)
    );

}





export default async function handler(req,res){


    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );



    const {

        id,

        offset,

        internal_offset,

        before,

        sort,

        order

    } = req.query;



    const data = {

        offset:
            Number(offset) || 0,


        internal_offset:
            internal_offset !== undefined
                ? Number(internal_offset)
                : undefined,


        before:
            before !== undefined
                ? Number(before)
                : undefined,


        query:
            String(id || ""),


        sort:
            sort || "time",


        order:
            order || "ascending"

    };



    const key =
        data.query;



    try {


        const result =
            await searchInfini(
                key,
                data
            );



        return res.json({

            query:
                data.query,


            offset:
                data.offset,


            count:
                result.items?.length || 0,


            internal_offset:
                result.internal_offset,


            items:
                result.items || []

        });


    }


    catch(err){

        console.error(err);


        return res.status(500).json({

            error:
                err.message,


            sent:
                data

        });

    }

}
