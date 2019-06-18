
import React from "react";
import {
    LOADED, TOKEN, PING, STYLE, ERROR, AUTO_SUBMIT, UPDATE, GET_TOKEN, INIT, FORMAT, SET_PLACEHOLDER, FOCUS, CLEAR_DATA,
    CARD_TYPE, SET_ACCOUNT_DATA, ENABLE_LOGGING, ENABLE_AUTO_SUBMIT, ENABLE3DS, UPDATE3DS, AMOUNT,
    MONTH, YEAR, WAIT_FOR_3DS_RESPONSE_TIMEOUT_DEFAULT, AUTO_FORMAT_DEFAULT_SEPARATOR, UPDATE_ISSUER
} from "./constants";

export default class IField extends React.Component {
    constructor(props) {
        super(props);
        this.validateProps();
        this.iFrameRef = React.createRef();
        this.state = {
            iFrameLoaded: false,
            xTokenReceived: false,
            latestErrorTime: new Date(),
            ifieldDataCache: {
                isValid: false,
                length: 0,
                isEmpty: true
            }
        };
    }
    render() {
        return (
            <iframe
                style={this.props.options.iFrameStyle}
                className={this.props.options.iFrameClassName}
                src={this.props.src}
                title={this.props.type}
                ref={this.iFrameRef}>
            </iframe>
        )
    }
    componentDidMount() {
        window.addEventListener('message', this.onMessage);
        this.ping();
    }
    componentWillUnmount() {
        window.removeEventListener('message', this.onMessage);
    }
    componentDidUpdate(prevProps) {
        if (this.props.account !== prevProps.account)
            this.setAccount(this.props.account);
        if (this.props.threeDS.enable3DS) {
            if (this.props.threeDS.enable3DS !== prevProps.threeDS.enable3DS)
                this.enable3DS(this.props.threeDS.waitForResponse, this.props.threeDS.waitForResponseTimeout);
            if (this.props.threeDS.amount !== prevProps.threeDS.amount)
                this.update3DS(AMOUNT, this.props.threeDS.amount);
            if (this.props.threeDS.month !== prevProps.threeDS.month)
                this.update3DS(MONTH, this.props.threeDS.month);
            if (this.props.threeDS.year !== prevProps.threeDS.year)
                this.update3DS(YEAR, this.props.threeDS.year);
        }
        if (this.props.issuer !== prevProps.issuer)
            this.updateIssuer(this.props.issuer);
        if (this.props.options.autoFormat) {
            if (this.props.options.autoFormat !== prevProps.options.autoFormat ||
                this.props.options.autoFormatSeparator !== prevProps.options.autoFormatSeparator)
                this.enableAutoFormat(this.props.options.autoFormatSeparator);
        }
        if (this.props.options.autoSubmit) {
            if (this.props.options.autoSubmit !== prevProps.options.autoSubmit ||
                this.props.options.autoSubmitFormId !== prevProps.options.autoSubmitFormId)
                this.enableAutoSubmit(this.props.options.autoSubmitFormId);
        }
        if (this.props.options.enableLogging !== prevProps.options.enableLogging)
            this.enableLogging();
        if (this.props.options.placeholder !== prevProps.options.placeholder)
            this.setPlaceholder(this.props.options.placeholder);
        if (this.props.options.iFieldstyle !== prevProps.options.iFieldstyle)
            this.setStyle(this.props.options.iFieldstyle);
    }
    //----------------------Events
    /**
     * 
     * @param {MessageEvent} e 
     */
    onMessage = (e) => {
        var data = e.data;
        if (e.source !== this.iFrameRef.current.contentWindow)
            return;
        switch (data.action) {
            case LOADED:
                this.log("Message received: ifield loaded");
                this.onLoad();
                break;
            case TOKEN:
                this.log("Message received: " + TOKEN);
                this.onToken(data);
                break;
            case AUTO_SUBMIT:
                this.log("Message received: " + AUTO_SUBMIT);
                this.onSubmit(data);
                break;
            case UPDATE:
                this.log("Message received: " + UPDATE);
                this.onUpdate(data);
                break;
            default:
                break;
        }
        if (this.props.threeDS.enable3DS &&
            data.eci &&
            data.eci.length &&
            this.props.type === CARD_TYPE) {
            this.log("Message received: eci");
            this.postMessage(data);
        }
    }
    onLoad() {
        var props = this.props;
        this.setState({ iFrameLoaded: true });
        this.setAccount(props.account);
        if (props.threeDS.enable3DS) {
            this.enable3DS(props.threeDS.waitForResponse, props.threeDS.waitForResponseTimeout);
            this.update3DS(AMOUNT, props.threeDS.amount);
            this.update3DS(MONTH, props.threeDS.month);
            this.update3DS(YEAR, props.threeDS.year);
        }
        this.init();
        if (props.issuer)
            this.updateIssuer(props.issuer);
        if (props.options.placeholder)
            this.setPlaceholder(props.options.placeholder);
        if (props.options.enableLogging)
            this.enableLogging();
        if (props.options.autoFormat)
            this.enableAutoFormat(props.options.autoFormatSeparator);
        if (props.options.autoSubmit)
            this.enableAutoSubmit(props.options.autoSubmitFormId);
        if (props.options.iFieldstyle)
            this.setStyle(props.options.iFieldstyle);
        if (props.onLoad)
            props.onLoad();
    }
    onToken(data) {
    onToken({ data }) {
        if (data.result === ERROR) {
            this.setState({ latestErrorTime: new Date() });
            this.log("Token Error: " + data.errorMessage);
            if (this.props.onError)
                this.props.onError(data);
        } else {
            this.setState({ xToken: data.xToken });
            if (this.props.onToken)
                this.props.onToken(data);
        }
    }
    onUpdate(data) {
        this.setState({
            ifieldDataCache: {
                length: this.props.type === CARD_TYPE ? data.data.cardNumberLength : data.data.length,
                isEmpty: data.data.isEmpty,
                isValid: data.data.isValid
            }
        });
        if (data.data.isValid) {
            this.getToken();
        }
        if (this.props.onUpdate)
            this.props.onUpdate(data.data);
    }
    onSubmit(data) {
        if (this.props.onSubmit)
            this.props.onSubmit(data.data);
        if (data.data && data.data.formId) {
            document.getElementById(data.data.formId).dispatchEvent(new Event("submit", {
                bubbles: true,
                cancelable: true
            }));
        }
    }
    //----------------------/
    //----------------------Actions
    ping() {
        var message = {
            action: PING
        };
        this.logAction(PING);
        this.postMessage(message);
    }
    setAccount(data) {
        var message = {
            action: SET_ACCOUNT_DATA,
            data
        };
        this.logAction(SET_ACCOUNT_DATA);
        this.postMessage(message);
    }
    init() {
        var message = {
            action: INIT,
            tokenType: this.props.type,
            referrer: window.location.toString()
        };
        this.logAction(INIT);
        this.postMessage(message);
    }
    getToken() {
        var message = {
            action: GET_TOKEN
        };
        this.logAction(GET_TOKEN);
        this.postMessage(message);
    }
    enable3DS(waitForResponse, waitForResponseTimeout) {
        var message = {
            action: ENABLE3DS,
            data: {
                waitForResponse,
                waitForResponseTimeout
            }
        };
        this.logAction(ENABLE3DS);
        this.postMessage(message);
    }
    update3DS(fieldName, value) {
        var message = {
            action: UPDATE3DS,
            data: {
                fieldName,
                value
            }
        };
        this.logAction(UPDATE3DS);
        this.postMessage(message);
    }
    updateIssuer(issuer) {
        var message = {
            action: UPDATE_ISSUER,
            issuer
        };
        this.logAction(UPDATE_ISSUER);
        this.postMessage(message);
    }
    setPlaceholder(data) {
        var message = {
            action: SET_PLACEHOLDER,
            data
        };
        this.logAction(SET_PLACEHOLDER);
        this.postMessage(message);
    }
    enableAutoFormat(formatChar) {
        var message = {
            action: FORMAT,
            data: {
                formatChar
            }
        };
        this.logAction(FORMAT);
        this.postMessage(message);
    }
    enableLogging() {
        var message = {
            action: ENABLE_LOGGING
        };
        this.logAction(ENABLE_LOGGING);
        this.postMessage(message);
    }
    enableAutoSubmit(formId) {
        var message = {
            action: ENABLE_AUTO_SUBMIT,
            data: {
                formId
            }
        };
        this.logAction(ENABLE_AUTO_SUBMIT);
        this.postMessage(message);
    }
    setStyle(data) {
        var message = {
            action: STYLE,
            data
        };
        this.logAction(STYLE);
        this.postMessage(message);
    }
    //----------------------Public Actions
    focusIfield() {
        var message = {
            action: FOCUS
        }
        this.logAction(FOCUS);
        this.postMessage(message);
    }
    clearIfield() {
        var message = {
            action: CLEAR_DATA
        };
        this.logAction(CLEAR_DATA);
        this.postMessage(message);
    }
    //----------------------/
    //----------------------Helper Functions
    postMessage(data) {
        if (!this.state.iFrameLoaded && data.action !== PING) {
            this.log("Iframe not loaded");
            return;
        }
        this.iFrameRef.current.contentWindow.postMessage(data, '*');
    }
    validateProps() {
        var props = this.props;
        var accountProps = props.account ?
            props.account.xKey ?
                props.account.xSoftwareName ?
                    props.account.xSoftwareVersion ? false :
                        'xSoftwareVersion' :
                    'xSoftwareName' :
                'xKey' :
            'account';
        if (accountProps) {
            this.error("Missing " + accountProps)
        }
        if (!props.type)
            this.error("Missing props (type)")
    }
    log(message) {
        if (this.props.options.enableLogging) {
            console.log(`IField ${this.props.type}: ${message}`);
        }
    }
    logAction(action) {
        this.log(`Sending message ${action}`);
    }
    error(message) {
        console.error(`IField ${this.props.type}: ${message}`);
    }
    //---------------------------/
}

IField.defaultProps = {
    options: {
        autoFormatSeparator: AUTO_FORMAT_DEFAULT_SEPARATOR
    },
    account: {},
    threeDS: {
        waitForResponseTimeout: WAIT_FOR_3DS_RESPONSE_TIMEOUT_DEFAULT
    }
};