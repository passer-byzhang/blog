import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faTwitter, faDiscord,faTelegram } from '@fortawesome/free-brands-svg-icons';
import {faEnvelopesBulk} from "@fortawesome/free-solid-svg-icons"
const ContactButtons: React.FC = () => {
  return (
    <div className="flex space-x-4">
      <a href="https://github.com/passer-byzhang" target="_blank" rel="noopener noreferrer">
        <FontAwesomeIcon icon={faGithub} size="sm" />
      </a>
      <a href="https://twitter.com/idokidokidok" target="_blank" rel="noopener noreferrer">
        <FontAwesomeIcon icon={faTwitter} size="sm" />
      </a>
      <a href="mailto: 19970216zhang@gamil.com" target="_blank" rel="noopener noreferrer">
        <FontAwesomeIcon icon={faEnvelopesBulk} size="sm"/>
      </a>
      <a href="https://t.me/AlvanZhang" target="_blank" rel="noopener noreferrer">
        <FontAwesomeIcon icon={faTelegram} size="sm" />
      </a>
    </div>
  );
};

export default ContactButtons;
