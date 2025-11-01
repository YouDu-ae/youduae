import React, { Component } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { useHistory, useLocation } from 'react-router-dom';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { useIntl } from '../../util/reactIntl';
import { parse } from '../../util/urlHelpers';
import { Page, NamedLink } from '../../components';
import TopbarContainer from '../TopbarContainer/TopbarContainer';
import SearchMap from '../SearchPage/SearchMap/SearchMap';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { searchListings, setActiveListing } from '../SearchPage/SearchPage.duck';

import css from './SearchMapPage.module.css';

export class SearchMapPageComponent extends Component {
  constructor(props) {
    super(props);
    this.onMapLoad = this.onMapLoad.bind(this);
  }

  onMapLoad(map) {
    // Карта успешно загружена
  }

  render() {
    const {
      listings = [],
      location,
      activeListingId,
      onActivateListing,
      config,
      intl,
    } = this.props;

    const searchParams = parse(location.search, {
      latlng: ['origin'],
      latlngBounds: ['bounds'],
    });

    const { origin, bounds } = searchParams;
    
    // ВСЕГДА используем дефолтные координаты ОАЭ (игнорируем bounds из URL)
    const { LatLng, LatLngBounds } = require('sharetribe-flex-sdk').types;
    const defaultUAECenter = new LatLng(24.5, 54.4); // Центр ОАЭ
    const defaultUAEBounds = new LatLngBounds(
      new LatLng(22.5, 51.5), // SW - юго-запад ОАЭ  
      new LatLng(26.0, 56.5)  // NE - северо-восток ОАЭ
    );

    return (
      <Page
        title={intl.formatMessage({ id: 'SearchMapPage.title' })}
        scrollingDisabled={false}
      >
        <TopbarContainer rootClassName={css.topbar} />
        
        <div className={css.container}>
          {/* Кнопка возврата */}
          <NamedLink name="SearchPage" className={css.backButton}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>{intl.formatMessage({ id: 'SearchMapPage.backToList' })}</span>
          </NamedLink>

          {/* Карта */}
          <div className={css.mapWrapper}>
            {config ? (
              <SearchMap
                reusableContainerClassName={css.map}
                rootClassName={css.mapRoot}
                activeListingId={activeListingId}
                bounds={null}
                center={defaultUAECenter}
                zoom={9}
                location={location}
                listings={listings || []}
                onMapLoad={this.onMapLoad}
                onMapMoveEnd={() => {}} // Не обновляем поиск при движении карты
                config={config}
                messages={intl.messages}
              />
            ) : (
              <div style={{ padding: '20px', color: '#333' }}>
                Loading map configuration...
              </div>
            )}
          </div>
        </div>
      </Page>
    );
  }
}

const EnhancedSearchMapPage = props => {
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();

  return (
    <SearchMapPageComponent
      config={config}
      routeConfiguration={routeConfiguration}
      intl={intl}
      history={history}
      location={location}
      {...props}
    />
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    currentPageResultIds,
    pagination,
    searchInProgress,
    searchListingsError,
    searchParams,
    activeListingId,
  } = state.SearchPage;
  
  const listings = getListingsById(state, currentPageResultIds);

  return {
    currentUser,
    listings,
    pagination,
    scrollingDisabled: false,
    searchInProgress,
    searchListingsError,
    searchParams,
    activeListingId,
  };
};

const mapDispatchToProps = dispatch => ({
  onActivateListing: listingId => dispatch(setActiveListing(listingId)),
});

const SearchMapPage = compose(
  connect(mapStateToProps, mapDispatchToProps)
)(EnhancedSearchMapPage);

export default SearchMapPage;

