import React, { Component } from 'react';
import { Form as FinalForm, Field } from 'react-final-form';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
import debounce from 'lodash/debounce';
import { injectIntl, intlShape, FormattedMessage } from '../../../util/reactIntl';
import { IconSearch } from '../../../components';
import { createResourceLocatorString } from '../../../util/routes';

import css from './SearchBar.module.css';

// Debounce время для поиска
const DEBOUNCE_WAIT_TIME = 600;

/**
 * SearchBar component for keyword search under topbar
 * @component
 */
class SearchBar extends Component {
  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.debouncedSubmit = debounce(this.handleSubmit, DEBOUNCE_WAIT_TIME, {
      leading: false,
      trailing: true,
    });
  }

  handleSubmit = values => {
    const keyword = values?.keywords || null;
    this.props.onSubmit({ keywords: keyword });
  };

  handleInputChange = values => {
    // Вызываем debounced submit при каждом изменении
    this.debouncedSubmit(values);
  };

  handleMapViewClick = () => {
    const { history, location, routeConfiguration } = this.props;
    // Переходим на отдельную страницу с картой, сохраняя текущие параметры поиска
    const mapUrl = createResourceLocatorString('SearchMapPage', routeConfiguration, {}, location.search);
    history.push(mapUrl);
  };

  render() {
    const { rootClassName, className, initialKeyword, intl, routeConfiguration } = this.props;
    const classes = classNames(rootClassName || css.root, className);
    const placeholder = intl.formatMessage({ id: 'KeywordFilter.placeholder' });
    const showMapButton = !!routeConfiguration; // Показываем кнопку только если есть routeConfiguration

    return (
      <div className={classes}>
        <div className={css.searchContainer}>
          <FinalForm
            onSubmit={this.handleSubmit}
            initialValues={{ keywords: initialKeyword || '' }}
            render={({ handleSubmit, values }) => (
              <form onSubmit={handleSubmit} className={css.form}>
                <div className={css.searchLine}>
                  <div className={css.inputWrapper}>
                    <IconSearch rootClassName={css.searchIcon} />
                    <Field name="keywords">
                      {({ input }) => (
                        <input
                          {...input}
                          ref={this.inputRef}
                          type="text"
                          className={css.input}
                          placeholder={placeholder}
                          autoComplete="off"
                          onChange={e => {
                            input.onChange(e);
                            this.handleInputChange(values);
                          }}
                        />
                      )}
                    </Field>
                  </div>
                  
                  {/* Кнопка "Найти" */}
                  <button type="submit" className={css.btnFind}>
                    <FormattedMessage id="SearchBar.findButton" />
                  </button>
                </div>
              </form>
            )}
          />
          
          {/* Кнопка перехода на карту */}
          {showMapButton && (
            <button
              type="button"
              className={css.mapToggleButton}
              onClick={this.handleMapViewClick}
            >
              <svg className={css.mapIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.3333 2.5L6.66667 5.83333L2.5 3.75V15.8333L6.66667 17.9167L13.3333 14.5833L17.5 16.6667V4.58333L13.3333 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.66667 5.83333V17.9167" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.3333 2.5V14.5833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>
                <FormattedMessage id="SearchBar.showMapView" />
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }
}

SearchBar.propTypes = {
  intl: intlShape.isRequired,
};

export default withRouter(injectIntl(SearchBar));

