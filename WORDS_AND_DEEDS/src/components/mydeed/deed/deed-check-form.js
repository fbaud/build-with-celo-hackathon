import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Button, Dropdown, DropdownButton, FormGroup, FormControl, FormLabel, InputGroup } from 'react-bootstrap';

import PropTypes from 'prop-types';

import { Dots } from 'react-activity';

import { faCopy, faUndo} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {CurrencyCardIcon} from '@primusmoney/react_pwa/react-js-ui';
import RemoteWalletIcon from '../../remote-wallet/remote-wallet-icon.js'

class DeedCheckForm extends React.Component {
	
	constructor(props) {
		super(props);
		
		this.app = this.props.app;
		this.parent = this.props.parent;
		
		this.getMvcMyPWAObject = this.app.getMvcMyPWAObject;
		this.getMvcMyDeedObject = this.app.getMvcMyDeedObject;

		this.dataobject = null;

		this.minter = null;
		this.deed = null;

		
		let mintername = '';

		let title = '';
		let description = '';

		let saleprice = '';

		let currency = {symbol: ''};

		let signingkey = null;
		let currentcard = null;
		let card_balance_int = 0;
		let card_balance_string = '';

		
		this.closing = false;
		
		this.state = {
			mintername,

			title,
			description,

			isOnSale: false,
			saleprice,

			currency,

			signingkey,
			isOwner: false,

			remotewallet: false,
			rpc: null,
			connection: null,

			currentcard,
			card_balance_int,
			card_balance_string,

			loaded: false,
			registration_text: 'loading...',
			message_text: 'loading...',
			sharelinkmessage: 'loading...',
			sharelink: 'loading...',
			processinginfo: 'processing transfer',
			processing: false

		}
	}


	_setState(state) {
		if (this.closing !== true)
		this.setState(state);
	}

	// deed and connection methods
	_getRemoteConnectionFromRpc(rpc) {
		return this.app.getDeedClientObject().getConnectionFromRpc(rpc);
	}

	async _getDeedOwningCard(currencyuuid, minter, deed) {
		let context = await this.app.getVariable('AppsPane').getDeedCardContext(currencyuuid, minter, deed);

		this._setState({remotewallet: context.remotewallet, rpc: context.rpc, connection: context.connection});

		return context.deedcard;
	}

	async _openCurrencyCard(currencyuuid) {
		let mvcmypwa = this.getMvcMyPWAObject();
		let mvcmydeed = this.getMvcMyDeedObject();

		let rootsessionuuid = this.props.rootsessionuuid;
		let walletuuid = this.props.currentwalletuuid;
		
		let card;

		let {remotewallet, remotecreate} = this.state;

		if ((remotewallet !== true) || (remotecreate !== true)){
			card = await this.app.openCurrencyCard(currencyuuid);
		}
		else {
			if (this.state.connection && (this.state.connection.account)) {
				card = await mvcmypwa.getCurrencyCardWithAddress(rootsessionuuid, walletuuid, currencyuuid, this.state.connection.account);
									 // creates read-only card if necessary

				// we connect the card
				let connected = await mvcmydeed.connectCard(rootsessionuuid, walletuuid, card.uuid, this.state.connection);

				// TODO: to be coherent, we should call this.app.openCard
				// but not really usefull, since we don't use redux for cards in pwa-apps
				// this.app.openCard(card.uuid);
			}
			else {
				return Promise.reject('remote connection is not activated');
			}
		}

		return card;
	}
	
	// post render commit phase
	componentDidUpdate(prevProps, prevState) {
		//console.log('DeedCreateForm.componentDidUpdate called');
		
		let mvcmypwa = this.getMvcMyPWAObject();

		let rootsessionuuid = this.props.rootsessionuuid;
		let walletuuid = this.props.currentwalletuuid;

		// entered a private key
		if (this.state.signingkey != prevState.signingkey) {
			const {currency} = this.state;

			if ( (currency) && (currency.uuid)) {
				let currentcard = null;
				let card_balance_string = '';
				let card_creditunits = '';
				
				let currencyuuid = currency.uuid;

				this.app.createCurrencyCard(currencyuuid, this.state.signingkey, {maincard: true})
				.then(card => {
					currentcard = card;

					return mvcmypwa.getCurrencyPosition(rootsessionuuid, walletuuid, currencyuuid, currentcard.uuid)
				})
				.then((pos) => {
					return mvcmypwa.formatCurrencyAmount(rootsessionuuid, currencyuuid, pos);
				})
				.then((balance) => {
					card_balance_string = balance;

					return mvcmypwa.getCreditBalance(rootsessionuuid, walletuuid, currentcard.uuid);
				})
				.then((credits) => {
					card_creditunits = credits.transactionunits;

					this._setState({currentcard, card_balance_string, card_creditunits})
				})
				.catch(err => {
					this._setState({currentcard, card_balance_string, card_creditunits})
				});
			}
		}


	}

	componentDidMount() {
		console.log('DeedCheckForm.componentDidMount called');
		
		let mvcmypwa = this.getMvcMyPWAObject();

		let registration_text = mvcmypwa.t('This deed has been registered.');

		let message_text = mvcmypwa.t(
			'This deed represents some rights that are potentially conferred to the owner of the deed. \
			Ownership can be asserted by the possession of the private key registered as owner of the deed. \
			If you haven\'t yet provided a private key for the corresponding currency, \
			you can add your private key through the currency cards menu. \
			If you provide a private key, it will be crypted and stored on your device, it will not leave \
			your device at any time and will not be shared with anyone. \
			This deed is registered and is accessible to anyone by clicking on \
			the link that has been generated. \
			Send this link to anyone to share the exact description of this deed.');
	
		let sharelinkmessage = mvcmypwa.t('You can share this deed with the following link:');
		
		
		this._setState({registration_text, message_text, sharelinkmessage});

		this.checkNavigationState().catch(err => {console.log('error in DeedCheckForm.checkNavigationState: ' + err);});
	}


	async checkNavigationState() {
		let mvcmypwa = this.getMvcMyPWAObject();
		let mvcmydeed = this.getMvcMyDeedObject();

		let rootsessionuuid = this.props.rootsessionuuid;
		let walletuuid = this.props.currentwalletuuid;

		let app_nav_state = this.app.getNavigationState();
		let app_nav_target = app_nav_state.target;

		// check wallet is unlocked
		let unlocked = await this.app.checkWalletUnlocked()
		.catch(err => {
		});

		if (!unlocked) {
			let params = (app_nav_target ? app_nav_target.params : null);
			this.app.gotoRoute('login', params);
			return;
			}
			else {
			// check it is not the device wallet, because we need a safer wallet
			let isdevicewallet = await this.app.isDeviceWallet();
			
			if (isdevicewallet) {
				await this.app.resetWallet();
				
				let params = (app_nav_target ? app_nav_target.params : null);
				this.app.gotoRoute('login', params);
				return;
			}
		}


		if (app_nav_target && (app_nav_target.route == 'deed') && (app_nav_target.reached == false)) {
			var params = app_nav_target.params;
			var dataobj = params.dataobject;

			if (dataobj && (dataobj.type === 'deed') && (dataobj.treated !== true)) {
				this.dataobject = dataobj;

				let currencyuuid = params.currencyuuid;
				let txhash = params.txhash;

				let minter_address = params.address;
				let tokenid = params.tokenid;

				// we fetch the deed to have a proper record
				let minter = await mvcmypwa.fetchDeedMinterFromAddress(rootsessionuuid, walletuuid, currencyuuid, minter_address);

				if (!minter)
					throw 'could not find minter with address ' + minter_address;

				this.minter = minter;
				let mintername = minter.name;

				let deed = await mvcmypwa.fetchDeed(rootsessionuuid, walletuuid, currencyuuid, minter, tokenid);
				this.deed = deed;

				// time
				let registration_time = (deed.metadata ? deed.metadata.time/1000 : null);
				let registration_text = mvcmypwa.t('This deed has been registered on');

				registration_text += ' ' + mvcmypwa.formatDate(registration_time, 'YYYY-mm-dd HH:MM:SS') + '.';
				
	
				// share link
				let currency = await mvcmypwa.getCurrencyFromUUID(rootsessionuuid, currencyuuid)
				.catch(err => {
					console.log('error in DeedCheckForm.checkNavigationState: ' + err);
				});

				if (!currency)
					return Promise.reject('could not find currency ' + currencyuuid);
	
				var sharelink = await this.app.getShareLink(txhash, currency.uuid);

				// check if deed is on sale
				let isOnSale = false;
				let saleprice = 0;
				let listing_info = await mvcmydeed.getDeedSaleInfo(rootsessionuuid, walletuuid, currencyuuid, minter, deed).catch(err => {});

				if (listing_info && (listing_info.onsale === true)) {
					isOnSale = true;
					saleprice = listing_info.saleprice;
				}
	
				// check if is owner (should not be)
				let isOwner = false;
				
				let currentcard = await this._openCurrencyCard(currencyuuid).catch(err => {});
				let card_balance_int = 0;
				let card_balance_string = '';

				if (currentcard) {
					isOwner = true;
					let pos = await mvcmypwa.getCurrencyPosition(rootsessionuuid, walletuuid, currencyuuid, currentcard.uuid);
			
					if (pos !== undefined) {
						card_balance_int = await pos.toInteger();
						card_balance_string = await mvcmypwa.formatCurrencyAmount(rootsessionuuid, currencyuuid, pos);
					}
				}

				this._setState({currency, mintername, 
					isOwner,
					currentcard, card_balance_int, card_balance_string,
					isOnSale, saleprice,
					registration_text, sharelink});

				dataobj.viewed = true;
			}

			// mark target as reached
			app_nav_target.reached = true;
		}

		if (this.deed) {
			let deed = this.deed;

			let tokenuri = deed.tokenuri;

			let title = (deed.metadata && deed.metadata.title ? deed.metadata.title : '');
			let description = (deed.metadata && deed.metadata.description ? deed.metadata.description : '');
			let external_url = (deed.metadata && deed.metadata.external_url ? deed.metadata.external_url : '');

			this._setState({tokenuri, title, description, external_url});
		}

		this._setState({loaded: true});
	}

 	// end of life
	componentWillUnmount() {
		console.log('DeedCheckForm.componentWillUnmount called');
		
		this.closing = true;
	}
	
	
	// user actions
	async onBuy() {
		console.log('onBuy pressed!');
		
		let mvcmypwa = this.getMvcMyPWAObject();
		let mvcmydeed = this.getMvcMyDeedObject();

		let rootsessionuuid = this.props.rootsessionuuid;
		let walletuuid = this.props.currentwalletuuid;
		
		let wallet;
		let carduuid;
		let card;

		let {currency, saleprice, remotewallet, rpc, currentcard, signingkey} =this.state;

		let remoteaccount;

		this._setState({processing: true});

		try {
			// get wallet details
			wallet = await mvcmypwa.getWalletInfo(rootsessionuuid, walletuuid);

			if (currentcard) {
				card = currentcard;
				carduuid = currentcard.uuid;
			}
			else {
				if (signingkey) {
					let currencyuuid = currency.uuid;
					let options = {maincard: true, allow_readonly: true};
		
					card = await this.app.createCurrencyCard(currencyuuid, signingkey, options)
					.catch(err => {
						console.log('error in ClauseCreateForm.onSubmit: ' + err);
					});
	
					if (!card) {
						this.app.alert('could not create card from private key');
						this._setState({processing: false});
						return;
					}
				}
				else {
					this.app.alert('You need to provide your private key for ' + currency.name + ' in order to being able to transfer this deed');
					this._setState({processing: false});
					return;
				}
		
			}

			if (remotewallet === true) {
				// we are connected and asked to execute transactions on remote wallet
				let connection = this._getRemoteConnectionFromRpc(rpc);
				remoteaccount = (connection ? connection.account : null);

				if (!remoteaccount) {
					this.app.alert('You need to be connected to a remote wallet');
					this._setState({processing: false});
					return;
				}

				// get card for remoteaccount
				currentcard = await mvcmypwa.getCurrencyCardWithAddress(rootsessionuuid, walletuuid, currency.uuid,
					remoteaccount); // creates read-only card if necessary
			}

			// send the buy transaction
			let minter = this.minter;
			let deed = this.deed;

		}
		catch(e) {
			console.log('exception in onBuy: ' + e);
			this.app.error('exception in onBuy: ' + e);

			this.app.alert('could not set price of deed')
		}

		this._setState({processing: false});
	}

	async onBack() {
		console.log('onBack pressed!');

		let currencyuuid = this.deed.currencyuuid;
		let txhash = this.deed.txhash;
		let address = this.deed.minter;
		let tokenid = this.deed.tokenid;
		
		let params = {action: 'view', currencyuuid, txhash, address, tokenid, dataobject: this.deed};

		this.app.gotoRoute('deed', params);
	}


	async onShareLinkClick() {
		const {sharelink} = this.state;
		
		// create a textarea on the fly, then remove it to
		// be able to copy to clipboard
		var textArea = document.createElement("textarea");
		textArea.value = sharelink;

		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand("Copy");
		textArea.remove();

		this.app.alert("Share link has been copied to clipboard");
	}

	async onTokenURIClick() {
		const {tokenuri} = this.state;
		
		// create a textarea on the fly, then remove it to
		// be able to copy to clipboard
		var textArea = document.createElement("textarea");
		textArea.value = tokenuri;

		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand("Copy");
		textArea.remove();

		this.app.alert("Token URI has been copied to clipboard");
	}

	async onExternalURLClick() {
		const {external_url} = this.state;
		
		// create a textarea on the fly, then remove it to
		// be able to copy to clipboard
		var textArea = document.createElement("textarea");
		textArea.value = external_url;

		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand("Copy");
		textArea.remove();

		this.app.alert("Asset url has been copied to clipboard");
	}

	
	// rendering
	renderDeedCardPart() {
		let { currency, remotewallet, connection, currentcard, signingkey, card_balance_string } = this.state;

		return (
			<span>
				{( remotewallet !== true ?
					(currentcard ?
					<FormGroup className="CurrencyCard" controlId="currencycard">
						<span className="CardIconCol">
							<CurrencyCardIcon
								app={this.app}
								currency={currency}
								card={currentcard}
							/>
						</span>
						<span className="CardBalanceCol">
							<FormLabel>Your Balance</FormLabel>
							<FormControl
								className="CardBalanceCol"
								disabled
								autoFocus
								type="text"
								value={card_balance_string}
							/>
						</span>
					</FormGroup> :
					<FormGroup controlId="signingkey">
						<FormLabel>'Your Private Key '{(currency && currency.name ? 'for ' + currency.name : '')}</FormLabel>
						<FormGroup>
							<FormControl
								autoFocus
								type="text"
								value={(signingkey ? signingkey : '')}
								onChange={e => this._setState({signingkey: e.target.value})}
							/>
						</FormGroup>
					</FormGroup>) :

					<FormGroup className="CurrencyCard" controlId="remotewallet">
					<span className="CardIconCol">
						<RemoteWalletIcon
								app={this.app}
								currency={currency}
								connection={connection}
							/>
					</span>
					<span className="CardBalanceCol">
						<FormLabel>Balance</FormLabel>
						<FormControl
							className="CardBalanceCol"
							disabled
							autoFocus
							type="text"
							value={card_balance_string}
						/>
					</span>
					</FormGroup>
				)}
			</span>

		);
	}

	renderDeedButtons() {
		let { loaded, isOwner, isOnSale} = this.state;

		if (loaded) {
			return(
				<div>
				<span>
				<Button onClick={this.onBuy.bind(this)} disabled={(isOnSale ? false : true)} type="submit">
				Buy</Button>
				</span>
				</div>
			);
		}
		else {
			return(	
				<div>
				<span>
				<Button disabled type="submit">
					loading...
				</Button>
				</span>
				</div>
			);
		}
	}

	renderDeedCheckForm() {
		let { mintername, title, description, currency, registration_text, message_text, sharelinkmessage, sharelink, saleprice, external_url } = this.state;
		
		return (
			<div className="Form">
				<FormGroup controlId="mintername">
				  <FormLabel>Minter Name</FormLabel>
				  <FormControl
					disabled
					autoFocus
					type="text"
					value={mintername}
					onChange={e => this._setState({mintername: e.target.value})}
				  />
				</FormGroup>

				<FormGroup controlId="title">
				  <FormLabel>Deed Title</FormLabel>
				  <FormControl
					disabled
					autoFocus
					type="text"
					value={title}
					onChange={e => this._setState({title: e.target.value})}
				  />
				</FormGroup>

				<FormGroup controlId="description">
				  <FormLabel>Description</FormLabel>
				  <FormControl 
					disabled
					as="textarea" 
					rows="5" 
					autoFocus
					type="text"
					value={description}
					onChange={e => this._setState({description: e.target.value})}
				  />
				</FormGroup>

				{this.renderDeedCardPart()}
				
				<FormGroup controlId="title">
				  <FormLabel>Sale price is</FormLabel>
				  <FormControl
					autoFocus
					type="text"
					value={saleprice}
					onChange={e => this._setState({saleprice: e.target.value})}
				  />
				</FormGroup>

				<FormGroup controlId="asseturl">
				  <FormLabel>Asset url</FormLabel>
				  <div className="ShareBlock">
				  <span className="ShareLink" onClick={this.onExternalURLClick.bind(this)}>{external_url}</span>
				  <span className="ShareIcon" onClick={this.onExternalURLClick.bind(this)}><FontAwesomeIcon icon={faCopy} /></span>
				  </div>
				</FormGroup>


				<div className="TextBox">
				  {registration_text}
			  	</div>

				<div className="TextBox">
					<div>{sharelinkmessage}</div>
					<div className="ShareBlock">
					<span className="ShareLink" onClick={this.onShareLinkClick.bind(this)}>{sharelink}</span>
					<span className="ShareIcon" onClick={this.onShareLinkClick.bind(this)}><FontAwesomeIcon icon={faCopy} /></span>
					</div>
				</div>

				{this.renderDeedButtons()}

				<div className="TextBox">
				  {message_text}
			  	</div>

			</div>
		  );
	}


	render() {
		let {processing} = this.state; 
		
		if (processing === true) {
			return (
				<div className="Splash">
					<div>{this.state.processinginfo}</div>
					<Dots />
				</div>
			);
		}
		
		return (
			<div className="Container">
				<div className="TitleBanner">
				<div className="Title">Check Deed</div>
				<div className="BackIcon" onClick={this.onBack.bind(this)}><FontAwesomeIcon icon={faUndo} /></div>
				</div>
				{ this.renderDeedCheckForm()}
			</div>
		  );
	}
	
}


// propTypes validation
DeedCheckForm.propTypes = {
	app: PropTypes.object.isRequired,
	rootsessionuuid: PropTypes.string,
	currentwalletuuid: PropTypes.string,
	iswalletlocked: PropTypes.bool,
};

//redux
const mapStateToProps = (state) => {
	return {
		rootsessionuuid: state.session.sessionuuid,
		pending: state.login.pending,
		success: state.login.success,
		lasterror: state.login.error,
		currentwalletuuid: state.wallets.walletuuid,
		iswalletlocked: state.wallets.islocked,
	};
}

const mapDispatchToProps = (dispatch) => {
	return {
	};
}


export {DeedCheckForm};
export default connect(mapStateToProps, mapDispatchToProps)(DeedCheckForm);
