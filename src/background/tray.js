import { nativeImage, systemPreferences, Menu, Tray as TrayIcon } from 'electron';
import { EventEmitter } from 'events';
import i18n from '../i18n/index.js';

const getTrayIconTitle = ({ badge: { title, count, showAlert }, status, showUserStatus }) => {
	// TODO: remove status icon from title, since ANSI codes disable title color's adaptiveness
	const isDarkMode = systemPreferences.getUserDefault('AppleInterfaceStyle', 'string') === 'Dark';

	const statusAnsiColor = {
		online: '32',
		away: '33',
		busy: '31',
		offline: isDarkMode ? '37' : '0',
	}[status];

	const badgeTitleAnsiColor = isDarkMode ? '37' : '0';

	const hasMentions = showAlert && count > 0;
	const statusBulletString = showUserStatus ? `\u001B[${ statusAnsiColor }m•\u001B[0m` : null;
	const badgeTitleString = hasMentions ? `\u001B[${ badgeTitleAnsiColor }m${ title }\u001B[0m` : null;

	return [statusBulletString, badgeTitleString].filter(Boolean).join(' ');
};

const getTrayIconTooltip = ({ badge: { count } }) => i18n.pluralize('Message_count', count, count);

const createContextMenuTemplate = ({ isMainWindowVisible }, events) => ([
	{
		label: !isMainWindowVisible ? i18n.__('Show') : i18n.__('Hide'),
		click: () => events.emit('set-main-window-visibility', !isMainWindowVisible),
	},
	{
		label: i18n.__('Quit'),
		click: () => events.emit('quit'),
	},
]);

class Tray extends EventEmitter {
	constructor() {
		super();

		this.state = {
			badge: {
				title: '',
				count: 0,
				showAlert: false,
			},
			status: 'online',
			isMainWindowVisible: true,
			showIcon: true,
			showUserStatus: true,
		};

		this.trayIcon = null;

		this.images = {};
	}

	setState(partialState) {
		this.state = {
			...this.state,
			...partialState,
		};
		this.update();
	}

	getIconImage() {
		const { title, count, showAlert } = this.state.badge;

		if (title === '•') {
			return this.images.dot;
		}

		if (count > 0) {
			return this.images[count > 9 ? '9plus' : String(count)];
		}

		if (showAlert) {
			return this.images.alert;
		}

		return this.images[process.platform === 'darwin' ? 'template' : 'normal'];
	}

	setIconImage(name, dataUrl) {
		this.images[name] = nativeImage.createFromDataURL(dataUrl);
	}

	createTrayIcon() {
		if (this.trayIcon) {
			return;
		}

		this.trayIcon = new TrayIcon(this.getIconImage());
		this.trayIcon.setToolTip(getTrayIconTooltip(this.state));

		this.trayIcon.on('click', () => this.emit('set-main-window-visibility', !this.state.isMainWindowVisible));
		this.trayIcon.on('right-click', (event, bounds) => this.trayIcon.popUpContextMenu(undefined, bounds));

		this.emit('created');
	}

	destroyTrayIcon() {
		if (!this.trayIcon) {
			return;
		}

		this.trayIcon.destroy();
		this.emit('destroyed');
		this.trayIcon = null;
	}

	destroy() {
		this.destroyTrayIcon();
		this.removeAllListeners();
	}

	update() {
		const { showIcon } = this.state;

		if (this.trayIcon && !showIcon) {
			this.destroyTrayIcon();
		} else if (!this.trayIcon && showIcon) {
			this.createTrayIcon();
		}

		if (!this.trayIcon) {
			this.emit('update');
			return;
		}

		this.trayIcon.setImage(this.getIconImage());

		if (process.platform === 'darwin') {
			this.trayIcon.setTitle(getTrayIconTitle(this.state));
		}

		this.trayIcon.setToolTip(getTrayIconTooltip(this.state));

		const template = createContextMenuTemplate(this.state, this);
		const menu = Menu.buildFromTemplate(template);
		this.trayIcon.setContextMenu(menu);
		this.emit('update');
	}
}

export default new Tray();
